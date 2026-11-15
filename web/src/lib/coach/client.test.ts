import { afterEach, describe, expect, it, vi } from "vitest";
import { requestCoach, CoachError } from "./client";
import { type CoachRequest } from "./schema";
const token="synthetic_preview_access_code_123456789";
const input: CoachRequest={consent:true,messages:[{role:"user",content:"How do I describe my fictional project?"}]};
const body={message:{role:"assistant",content:"What did you personally build?"},advisory:"unverified"};
const ok=(value:unknown=body,mode="live")=>Response.json(value,{headers:{"X-ScaleMe-Mode":mode}});
afterEach(()=>vi.useRealTimers());
describe("bounded coach transport",()=>{
  it("only sends explicit context and header code, no credentials/cache/redirects",async()=>{
    const fetcher=vi.fn().mockResolvedValue(ok());
    expect(await requestCoach(input,token,new AbortController().signal,fetcher)).toEqual(body);
    expect(fetcher).toHaveBeenCalledOnce();const [path,options]=fetcher.mock.calls[0];
    expect(path).toBe("/api/coach/message");expect(options).toMatchObject({method:"POST",credentials:"omit",cache:"no-store",redirect:"error",headers:{Authorization:`Bearer ${token}`}});
    expect(options.body).not.toContain(token);expect(JSON.parse(options.body)).toEqual(input);
  });
  it.each(["demo","", "scripted"])("rejects mode confusion %s",async mode=>{
    await expect(requestCoach(input,token,new AbortController().signal,vi.fn().mockResolvedValue(ok(body,mode)))).rejects.toMatchObject({status:502});
  });
  it.each([{}, {message:{role:"assistant",content:"x"},advisory:"verified"},{...body,analysis:{score:90}}])("rejects malformed responses %#",async response=>{
    await expect(requestCoach(input,token,new AbortController().signal,vi.fn().mockResolvedValue(ok(response)))).rejects.toMatchObject({status:502});
  });
  it.each([401,403,408,413,429,502,503,504])("shows safe errors for %s without echoing remote content",async status=>{
    const error=await requestCoach(input,token,new AbortController().signal,vi.fn().mockResolvedValue(Response.json({error:{message:"sensitive-canary"}},{status,headers:{"Retry-After":"2"}}))).catch(e=>e);
    expect(error).toBeInstanceOf(CoachError);expect(error.status).toBe(status);expect(error.message).not.toContain("sensitive-canary");expect(error.retryAfter).toBe(status===429?2:0);
  });
  it("refuses bad token, lack of consent and oversized sessions without fetch",async()=>{
    const fetcher=vi.fn();
    for(const [request,code] of [[input,"bad"],[{...input,consent:false},token],[{...input,messages:[{role:"user",content:"x".repeat(2001)}]},token]] as const){
      await expect(requestCoach(request as CoachRequest,code,new AbortController().signal,fetcher)).rejects.toBeInstanceOf(CoachError);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds response bytes",async()=>{
    await expect(requestCoach(input,token,new AbortController().signal,vi.fn().mockResolvedValue(new Response("x".repeat(16001))))).rejects.toMatchObject({status:502});
  });
  it("discards late response after cancellation even if transport ignores abort",async()=>{
    const controller=new AbortController();let finish!: (r:Response)=>void;
    const promise=requestCoach(input,token,controller.signal,vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve;})));
    controller.abort();finish(ok());await expect(promise).rejects.toMatchObject({status:0,message:expect.stringContaining("cancelled")});
  });
  it("aborts on client timeout and does not auto-retry",async()=>{
    vi.useFakeTimers();const fetcher=vi.fn().mockImplementation((_path,{signal})=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(new Error("aborted")))));
    const result=requestCoach(input,token,new AbortController().signal,fetcher).catch(e=>e);
    await vi.advanceTimersByTimeAsync(55001);expect((await result).message).toContain("timed out");expect(fetcher).toHaveBeenCalledOnce();
  });
  it("does not fetch if already cancelled; network failure has no fake reply",async()=>{
    const controller=new AbortController();controller.abort();const fetcher=vi.fn();
    await expect(requestCoach(input,token,controller.signal,fetcher)).rejects.toBeInstanceOf(CoachError);expect(fetcher).not.toHaveBeenCalled();
    await expect(requestCoach(input,token,new AbortController().signal,vi.fn().mockRejectedValue(new Error("secret")))).rejects.toMatchObject({status:0,message:expect.stringContaining("Could not reach")});
  });
});
