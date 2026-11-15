import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
const send=vi.fn();const configs:unknown[]=[];
vi.mock("@aws-sdk/client-bedrock-runtime",()=>({
  BedrockRuntimeClient:class{send=send;constructor(config:unknown){configs.push(config);}},
  ConverseCommand:class{constructor(public input:unknown){}},
}));
import { POST } from "@/app/api/coach/message/route";
import { resetSharedFitLimiter } from "@/lib/ai/rate-limit";
const token="fictional_sdk_preview_code_1234567890";
const canary="fictional-person@example.invalid";
function request(code=token){return new Request("http://localhost/api/coach/message",{method:"POST",headers:{Authorization:`Bearer ${code}`,"Content-Type":"application/json"},body:JSON.stringify({consent:true,messages:[{role:"user",content:`I built a fictional project. ${canary}`} ]})});}
beforeEach(()=>{
  resetSharedFitLimiter();send.mockReset();
  for(const [name,value] of Object.entries({FIT_LIVE_AI_ENABLED:"true",COACH_LIVE_AI_ENABLED:"true",SCALEME_PRIVATE_AI_TOKEN:token,AWS_REGION:"fictional-sdk-region",BEDROCK_MODEL_ID:"fictional-model",BEDROCK_TIMEOUT_MS:"100"}))vi.stubEnv(name,value);
  vi.spyOn(console,"info").mockImplementation(()=>{});vi.spyOn(console,"warn").mockImplementation(()=>{});vi.spyOn(console,"error").mockImplementation(()=>{});
  send.mockResolvedValue({output:{message:{content:[{text:JSON.stringify({reply:`What did you test for ${canary}?`})}]}},usage:{inputTokens:120,outputTokens:30,totalTokens:150},metrics:{latencyMs:15},stopReason:"end_turn"});
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe("coach route → real provider wrapper → mocked SDK",()=>{
  it("uses single Converse attempt, bounded tokens, timeout, no tools and numeric-only usage",async()=>{
    expect((await POST(request())).status).toBe(200);expect(send).toHaveBeenCalledOnce();expect(configs.at(-1)).toMatchObject({maxAttempts:1});
    const [command,options]=send.mock.calls[0];expect(command.input.inferenceConfig.maxTokens).toBe(500);expect(command.input.toolConfig).toBeUndefined();expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    const line=vi.mocked(console.info).mock.calls.flat().join(" ");expect(line).toMatch(/\[coach\/message\] Bedrock usage: inputTokens=120 outputTokens=30 totalTokens=150/);expect(line).not.toContain(canary);expect(line).not.toContain(token);
  });
  it.each(["TimeoutError","ThrottlingException","AccessDeniedException"])("safe SDK %s; no retry or raw exception",async name=>{
    send.mockRejectedValue(Object.assign(new Error(`sensitive ${token} ${canary}`),{name}));const response=await POST(request());expect(response.status).toBe(name==="TimeoutError"?504:503);expect(send).toHaveBeenCalledOnce();
    const logs=[...vi.mocked(console.info).mock.calls,...vi.mocked(console.warn).mock.calls,...vi.mocked(console.error).mock.calls].flat().join(" ")+await response.text();expect(logs).not.toContain(canary);expect(logs).not.toContain(token);
  });
  it("enforces actual abort signal timeout with mocked SDK, never AWS",async()=>{
    send.mockImplementation((_command,{abortSignal})=>new Promise((_,reject)=>abortSignal.addEventListener("abort",()=>reject(Object.assign(new Error("synthetic"),{name:"TimeoutError"})))));
    expect((await POST(request())).status).toBe(504);expect(send).toHaveBeenCalledOnce();
  });
  it("unauthorized direct invocation never initializes provider or spends",async()=>{expect((await POST(request("wrong"))).status).toBe(401);expect(send).not.toHaveBeenCalled();});
});
