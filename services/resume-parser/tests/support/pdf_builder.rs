//! Minimal, dependency-free PDF writer used ONLY to generate synthetic test fixtures in memory.
//!
//! Every fixture is built at test time from fictional text, so no binary PDF (and no real
//! resume) is ever committed. The writer covers just what the tests need:
//!
//! * standard-14 Helvetica / Helvetica-Bold text with WinAnsi encoding,
//! * a Type0 font with an explicit ToUnicode CMap for characters outside WinAnsi,
//! * multiple pages, absolute text positioning, and image-only pages,
//! * real RC4 (Standard security handler, revision 2) encryption for password tests.
//!
//! It is not a general PDF library and must never be used on untrusted input.

#![allow(dead_code)]

use std::collections::BTreeMap;
use std::fmt::Write as _;

/// Font used for a text run.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Font {
    /// Helvetica, WinAnsiEncoding.
    Regular,
    /// Helvetica-Bold, WinAnsiEncoding.
    Bold,
    /// Type0 / Identity-H font whose ToUnicode CMap maps each code to an arbitrary character.
    Unicode,
}

#[derive(Clone, Debug)]
pub struct Run {
    pub x: f32,
    pub y: f32,
    pub size: f32,
    pub font: Font,
    pub text: String,
}

#[derive(Clone, Debug, Default)]
pub struct Page {
    pub runs: Vec<Run>,
    /// Paint one opaque raster image covering most of the page (simulates a scan).
    pub image: bool,
}

impl Page {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn text(mut self, x: f32, y: f32, size: f32, font: Font, text: &str) -> Self {
        self.runs.push(Run {
            x,
            y,
            size,
            font,
            text: text.to_string(),
        });
        self
    }

    pub fn push(&mut self, x: f32, y: f32, size: f32, font: Font, text: &str) {
        self.runs.push(Run {
            x,
            y,
            size,
            font,
            text: text.to_string(),
        });
    }

    pub fn with_image(mut self) -> Self {
        self.image = true;
        self
    }
}

#[derive(Clone, Debug)]
pub struct Rc4Encryption {
    pub user_password: Vec<u8>,
    pub owner_password: Vec<u8>,
}

/// How WinAnsi text runs are written into the content stream. Real producers differ a lot, so
/// extraction is tested against all three.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum TextMode {
    /// One `Tj` per run, spaces included (typical of simple generators).
    #[default]
    WholeLine,
    /// Every word is positioned on its own and NO space glyphs are drawn (typical of TeX-like
    /// producers); the extractor has to infer the spaces from the gaps.
    WordPositioned,
    /// One `TJ` array per run with small kerning adjustments inside words.
    Kerned,
}

#[derive(Clone, Debug, Default)]
pub struct PdfBuilder {
    pub pages: Vec<Page>,
    pub text_mode: TextMode,
    pub encryption: Option<Rc4Encryption>,
    /// Optional /Title in the document information dictionary (never encrypted docs).
    pub title: Option<String>,
    /// Raw entries appended to the document catalog, e.g. an `/OpenAction`. Used to prove that
    /// active content is ignored.
    pub catalog_extra: Option<String>,
}

pub const PAGE_WIDTH: f32 = 612.0;
pub const PAGE_HEIGHT: f32 = 792.0;

impl PdfBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn page(mut self, page: Page) -> Self {
        self.pages.push(page);
        self
    }

    pub fn encrypt_rc4(mut self, user_password: &str, owner_password: &str) -> Self {
        self.encryption = Some(Rc4Encryption {
            user_password: user_password.as_bytes().to_vec(),
            owner_password: owner_password.as_bytes().to_vec(),
        });
        self
    }

    pub fn text_mode(mut self, mode: TextMode) -> Self {
        self.text_mode = mode;
        self
    }

    pub fn catalog_extra(mut self, raw: &str) -> Self {
        self.catalog_extra = Some(raw.to_string());
        self
    }

    pub fn title(mut self, title: &str) -> Self {
        self.title = Some(title.to_string());
        self
    }

    /// Serialize the document to PDF bytes.
    pub fn build(&self) -> Vec<u8> {
        assert!(
            !self.pages.is_empty(),
            "fixture must have at least one page"
        );

        // Assign 2-byte CIDs to every character drawn with the Unicode font.
        let mut cids: BTreeMap<char, u16> = BTreeMap::new();
        for page in &self.pages {
            for run in page.runs.iter().filter(|r| r.font == Font::Unicode) {
                for ch in run.text.chars() {
                    let next = cids.len() as u16 + 1;
                    cids.entry(ch).or_insert(next);
                }
            }
        }

        // Fixed object numbers.
        const CATALOG: u32 = 1;
        const PAGES: u32 = 2;
        const F1: u32 = 3;
        const F2: u32 = 4;
        const F3: u32 = 5;
        const CIDFONT: u32 = 6;
        const DESCRIPTOR: u32 = 7;
        const TOUNICODE: u32 = 8;
        const IMAGE: u32 = 9;
        const INFO: u32 = 10;
        const ENCRYPT: u32 = 11;
        const FIRST_PAGE: u32 = 12;

        let page_obj = |i: usize| FIRST_PAGE + (i as u32) * 2;
        let content_obj = |i: usize| FIRST_PAGE + (i as u32) * 2 + 1;
        let max_obj = FIRST_PAGE + (self.pages.len() as u32) * 2 - 1;

        let file_id: [u8; 16] = *b"ScaleMeSynthetic";
        let crypt = self
            .encryption
            .as_ref()
            .map(|enc| Rc4Crypt::new(enc, &file_id));

        let mut objects: BTreeMap<u32, Vec<u8>> = BTreeMap::new();

        objects.insert(
            CATALOG,
            format!(
                "<< /Type /Catalog /Pages {PAGES} 0 R {} >>",
                self.catalog_extra.as_deref().unwrap_or("")
            )
            .into_bytes(),
        );

        let kids: String = (0..self.pages.len())
            .map(|i| format!("{} 0 R", page_obj(i)))
            .collect::<Vec<_>>()
            .join(" ");
        objects.insert(
            PAGES,
            format!(
                "<< /Type /Pages /Kids [{kids}] /Count {} >>",
                self.pages.len()
            )
            .into_bytes(),
        );

        objects.insert(
            F1,
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
                .to_vec(),
        );
        objects.insert(
            F2,
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
                .to_vec(),
        );
        objects.insert(
            F3,
            format!(
                "<< /Type /Font /Subtype /Type0 /BaseFont /SyntheticUnicode /Encoding /Identity-H \
                 /DescendantFonts [{CIDFONT} 0 R] /ToUnicode {TOUNICODE} 0 R >>"
            )
            .into_bytes(),
        );
        objects.insert(
            CIDFONT,
            format!(
                "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SyntheticUnicode \
                 /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> \
                 /FontDescriptor {DESCRIPTOR} 0 R /DW 600 /CIDToGIDMap /Identity >>"
            )
            .into_bytes(),
        );
        objects.insert(
            DESCRIPTOR,
            b"<< /Type /FontDescriptor /FontName /SyntheticUnicode /Flags 32 \
              /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 900 /Descent -200 \
              /CapHeight 700 /StemV 80 >>"
                .to_vec(),
        );

        // ToUnicode CMap.
        let mut cmap = String::new();
        cmap.push_str(
            "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n\
             /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n\
             /CMapName /Synthetic-UCS def\n/CMapType 2 def\n\
             1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n",
        );
        let entries: Vec<(&char, &u16)> = cids.iter().collect();
        for chunk in entries.chunks(100) {
            let _ = writeln!(cmap, "{} beginbfchar", chunk.len());
            for (ch, cid) in chunk {
                let mut utf16 = [0u16; 2];
                let hex: String = ch
                    .encode_utf16(&mut utf16)
                    .iter()
                    .map(|u| format!("{u:04X}"))
                    .collect();
                let _ = writeln!(cmap, "<{cid:04X}> <{hex}>");
            }
            cmap.push_str("endbfchar\n");
        }
        cmap.push_str("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n");
        objects.insert(
            TOUNICODE,
            stream_object("", cmap.as_bytes(), crypt.as_ref().map(|c| (c, TOUNICODE))),
        );

        // 8x8 grey checkerboard image (8 bits per component).
        let pixels: Vec<u8> = (0..64)
            .map(|i| if (i / 8 + i % 8) % 2 == 0 { 0x20 } else { 0xD0 })
            .collect();
        objects.insert(
            IMAGE,
            stream_object(
                "/Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray \
                 /BitsPerComponent 8",
                &pixels,
                crypt.as_ref().map(|c| (c, IMAGE)),
            ),
        );

        let has_info = self.title.is_some() && crypt.is_none();
        if let Some(title) = self.title.as_ref().filter(|_| has_info) {
            objects.insert(
                INFO,
                format!(
                    "<< /Title ({}) /Producer (ScaleMe synthetic fixture builder) >>",
                    escape_literal(&encode_win_ansi(title))
                )
                .into_bytes(),
            );
        }

        if let Some(c) = crypt.as_ref() {
            objects.insert(
                ENCRYPT,
                format!(
                    "<< /Filter /Standard /V 1 /R 2 /O <{}> /U <{}> /P {} >>",
                    hex(&c.o_value),
                    hex(&c.u_value),
                    c.permissions
                )
                .into_bytes(),
            );
        }

        for (i, page) in self.pages.iter().enumerate() {
            let mut content = String::new();
            if page.image {
                content.push_str("q 500 0 0 680 56 56 cm /Im1 Do Q\n");
            }
            for run in &page.runs {
                write_run(&mut content, run, self.text_mode, &cids);
            }
            // Only declare the resources the page really uses, as real producers do.
            let uses = |f: Font| page.runs.iter().any(|r| r.font == f);
            let mut font_entries = String::new();
            if uses(Font::Regular) {
                let _ = write!(font_entries, "/F1 {F1} 0 R ");
            }
            if uses(Font::Bold) {
                let _ = write!(font_entries, "/F2 {F2} 0 R ");
            }
            if uses(Font::Unicode) {
                let _ = write!(font_entries, "/F3 {F3} 0 R ");
            }
            let fonts = if font_entries.is_empty() {
                String::new()
            } else {
                format!("/Font << {font_entries}>> ")
            };
            let xobjects = if page.image {
                format!("/XObject << /Im1 {IMAGE} 0 R >>")
            } else {
                String::new()
            };
            let content_id = content_obj(i);
            objects.insert(
                content_id,
                stream_object(
                    "",
                    content.as_bytes(),
                    crypt.as_ref().map(|c| (c, content_id)),
                ),
            );
            objects.insert(
                page_obj(i),
                format!(
                    "<< /Type /Page /Parent {PAGES} 0 R /MediaBox [0 0 {} {}] \
                     /Resources << {fonts}{xobjects} >> /Contents {content_id} 0 R >>",
                    fmt_num(PAGE_WIDTH),
                    fmt_num(PAGE_HEIGHT)
                )
                .into_bytes(),
            );
        }

        // Serialize with an exact cross-reference table.
        let mut out: Vec<u8> = Vec::new();
        out.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
        let mut offsets: BTreeMap<u32, usize> = BTreeMap::new();
        for (id, body) in &objects {
            offsets.insert(*id, out.len());
            out.extend_from_slice(format!("{id} 0 obj\n").as_bytes());
            out.extend_from_slice(body);
            out.extend_from_slice(b"\nendobj\n");
        }
        let xref_at = out.len();
        let size = max_obj + 1;
        out.extend_from_slice(format!("xref\n0 {size}\n").as_bytes());
        out.extend_from_slice(b"0000000000 65535 f \n");
        for id in 1..size {
            match offsets.get(&id) {
                Some(off) => out.extend_from_slice(format!("{off:010} 00000 n \n").as_bytes()),
                None => out.extend_from_slice(b"0000000000 65535 f \n"),
            }
        }
        let mut trailer = format!("<< /Size {size} /Root {CATALOG} 0 R");
        if has_info {
            let _ = write!(trailer, " /Info {INFO} 0 R");
        }
        if crypt.is_some() {
            let _ = write!(trailer, " /Encrypt {ENCRYPT} 0 R");
        }
        let _ = write!(trailer, " /ID [<{0}> <{0}>] >>", hex(&file_id));
        out.extend_from_slice(
            format!("trailer\n{trailer}\nstartxref\n{xref_at}\n%%EOF\n").as_bytes(),
        );
        out
    }
}

fn write_run(content: &mut String, run: &Run, mode: TextMode, cids: &BTreeMap<char, u16>) {
    let size = fmt_num(run.size);
    let (x, y) = (run.x, run.y);
    let font_name = match run.font {
        Font::Regular => "F1",
        Font::Bold => "F2",
        Font::Unicode => {
            let codes: String = run
                .text
                .chars()
                .map(|c| format!("{:04X}", cids[&c]))
                .collect();
            let _ = writeln!(
                content,
                "BT /F3 {size} Tf {} {} Td <{codes}> Tj ET",
                fmt_num(x),
                fmt_num(y)
            );
            return;
        }
    };
    match mode {
        TextMode::WholeLine => {
            let _ = writeln!(
                content,
                "BT /{font_name} {size} Tf {} {} Td {} Tj ET",
                fmt_num(x),
                fmt_num(y),
                literal(&run.text)
            );
        }
        TextMode::WordPositioned => {
            let mut cursor = x;
            for word in run.text.split(' ') {
                if !word.is_empty() {
                    let _ = writeln!(
                        content,
                        "BT /{font_name} {size} Tf {} {} Td {} Tj ET",
                        fmt_num(cursor),
                        fmt_num(y),
                        literal(word)
                    );
                }
                // Helvetica-Bold is roughly 10% wider than the regular face.
                let scale = if run.font == Font::Bold { 1.1 } else { 1.0 };
                cursor += (text_width(word) * scale + helvetica_width(' ')) * run.size / 1000.0;
            }
        }
        TextMode::Kerned => {
            let chars: Vec<char> = run.text.chars().collect();
            let mut array = String::from("[");
            for (i, chunk) in chars.chunks(3).enumerate() {
                let piece: String = chunk.iter().collect();
                if i > 0 {
                    // Small adjustments (thousandths of an em) that never amount to a space.
                    let _ = write!(array, " {} ", if i % 2 == 0 { -18 } else { 22 });
                }
                array.push_str(&literal(&piece));
            }
            array.push(']');
            let _ = writeln!(
                content,
                "BT /{font_name} {size} Tf {} {} Td {array} TJ ET",
                fmt_num(x),
                fmt_num(y)
            );
        }
    }
}

/// Width of `text` in thousandths of an em, using Helvetica's standard metrics.
pub fn text_width(text: &str) -> f32 {
    text.chars().map(helvetica_width).sum()
}

/// Helvetica advance widths (Adobe standard-14 metrics) for printable ASCII; other characters
/// use the digit width, which is close enough for fixture layout.
fn helvetica_width(c: char) -> f32 {
    const ASCII: [u16; 95] = [
        278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556,
        556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722,
        722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
        667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
        556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
        500, 334, 260, 334, 584,
    ];
    match c {
        ' '..='~' => f32::from(ASCII[c as usize - 0x20]),
        '\u{2022}' => 350.0,
        _ => 556.0,
    }
}

fn stream_object(extra_dict: &str, data: &[u8], crypt: Option<(&Rc4Crypt, u32)>) -> Vec<u8> {
    let payload = match crypt {
        Some((c, id)) => c.encrypt_object_data(id, data),
        None => data.to_vec(),
    };
    let mut body = format!("<< {extra_dict} /Length {} >>\nstream\n", payload.len()).into_bytes();
    body.extend_from_slice(&payload);
    body.extend_from_slice(b"\nendstream");
    body
}

fn fmt_num(v: f32) -> String {
    if v.fract() == 0.0 {
        format!("{}", v as i64)
    } else {
        format!("{v:.2}")
    }
}

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02X}")).collect()
}

fn literal(text: &str) -> String {
    format!("({})", escape_literal(&encode_win_ansi(text)))
}

/// Escape a byte string for a PDF literal string; non-ASCII bytes become octal escapes so the
/// content stream stays 7-bit clean.
fn escape_literal(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len());
    for &b in bytes {
        match b {
            b'(' => s.push_str("\\("),
            b')' => s.push_str("\\)"),
            b'\\' => s.push_str("\\\\"),
            0x20..=0x7E => s.push(b as char),
            _ => {
                let _ = write!(s, "\\{b:03o}");
            }
        }
    }
    s
}

/// Encode text as WinAnsi (CP1252). Panics on characters the fixture author must draw with
/// [`Font::Unicode`] instead.
pub fn encode_win_ansi(text: &str) -> Vec<u8> {
    text.chars()
        .map(|c| match c {
            '\u{20}'..='\u{7E}' => c as u8,
            '\u{A0}'..='\u{FF}' => c as u32 as u8,
            '\u{2022}' => 0x95, // bullet
            '\u{2013}' => 0x96, // en dash
            '\u{2014}' => 0x97, // em dash
            '\u{2018}' => 0x91,
            '\u{2019}' => 0x92,
            '\u{201C}' => 0x93,
            '\u{201D}' => 0x94,
            '\u{20AC}' => 0x80,
            other => panic!("character {other:?} is not in WinAnsi; use Font::Unicode"),
        })
        .collect()
}

// ---------------------------------------------------------------------------------------------
// RC4 Standard security handler, revision 2 (40-bit). Test-only; RC4 is obsolete and weak, which
// is irrelevant here because the goal is only to produce a genuinely password-protected file.
// ---------------------------------------------------------------------------------------------

const PASSWORD_PAD: [u8; 32] = [
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A,
];

struct Rc4Crypt {
    file_key: [u8; 5],
    o_value: [u8; 32],
    u_value: [u8; 32],
    permissions: i32,
}

impl Rc4Crypt {
    fn new(enc: &Rc4Encryption, file_id: &[u8]) -> Self {
        let permissions: i32 = -44; // printing and copying disallowed
        let padded_owner = pad_password(&enc.owner_password);
        let padded_user = pad_password(&enc.user_password);

        let owner_digest = md5(&padded_owner);
        let o_value_vec = rc4(&owner_digest[..5], &padded_user);
        let mut o_value = [0u8; 32];
        o_value.copy_from_slice(&o_value_vec);

        let mut key_input = Vec::new();
        key_input.extend_from_slice(&padded_user);
        key_input.extend_from_slice(&o_value);
        key_input.extend_from_slice(&permissions.to_le_bytes());
        key_input.extend_from_slice(file_id);
        let digest = md5(&key_input);
        let mut file_key = [0u8; 5];
        file_key.copy_from_slice(&digest[..5]);

        let u_vec = rc4(&file_key, &PASSWORD_PAD);
        let mut u_value = [0u8; 32];
        u_value.copy_from_slice(&u_vec);

        Self {
            file_key,
            o_value,
            u_value,
            permissions,
        }
    }

    fn encrypt_object_data(&self, object_number: u32, data: &[u8]) -> Vec<u8> {
        let mut key_input = self.file_key.to_vec();
        key_input.extend_from_slice(&object_number.to_le_bytes()[..3]);
        key_input.extend_from_slice(&[0, 0]); // generation 0
        let digest = md5(&key_input);
        rc4(&digest[..10], data)
    }
}

fn pad_password(password: &[u8]) -> [u8; 32] {
    let mut out = [0u8; 32];
    let n = password.len().min(32);
    out[..n].copy_from_slice(&password[..n]);
    out[n..].copy_from_slice(&PASSWORD_PAD[..32 - n]);
    out
}

pub fn rc4(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut s: [u8; 256] = std::array::from_fn(|i| i as u8);
    let mut j: u8 = 0;
    for i in 0..256 {
        j = j.wrapping_add(s[i]).wrapping_add(key[i % key.len()]);
        s.swap(i, j as usize);
    }
    let (mut i, mut j) = (0u8, 0u8);
    data.iter()
        .map(|&b| {
            i = i.wrapping_add(1);
            j = j.wrapping_add(s[i as usize]);
            s.swap(i as usize, j as usize);
            b ^ s[(s[i as usize].wrapping_add(s[j as usize])) as usize]
        })
        .collect()
}

/// Straightforward MD5 (RFC 1321), sufficient for the RC4 key schedule above.
pub fn md5(input: &[u8]) -> [u8; 16] {
    const S: [u32; 64] = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5,
        9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10,
        15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];
    let k: Vec<u32> = (0..64)
        .map(|i| ((i as f64 + 1.0).sin().abs() * 4_294_967_296.0) as u32)
        .collect();
    let (mut a0, mut b0, mut c0, mut d0): (u32, u32, u32, u32) =
        (0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476);

    let mut msg = input.to_vec();
    let bit_len = (input.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_le_bytes());

    for chunk in msg.chunks(64) {
        let m: Vec<u32> = chunk
            .chunks(4)
            .map(|w| u32::from_le_bytes([w[0], w[1], w[2], w[3]]))
            .collect();
        let (mut a, mut b, mut c, mut d) = (a0, b0, c0, d0);
        for i in 0..64 {
            let (f, g) = match i {
                0..=15 => ((b & c) | (!b & d), i),
                16..=31 => ((d & b) | (!d & c), (5 * i + 1) % 16),
                32..=47 => (b ^ c ^ d, (3 * i + 5) % 16),
                _ => (c ^ (b | !d), (7 * i) % 16),
            };
            let f = f.wrapping_add(a).wrapping_add(k[i]).wrapping_add(m[g]);
            a = d;
            d = c;
            c = b;
            b = b.wrapping_add(f.rotate_left(S[i]));
        }
        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }
    let mut out = [0u8; 16];
    out[..4].copy_from_slice(&a0.to_le_bytes());
    out[4..8].copy_from_slice(&b0.to_le_bytes());
    out[8..12].copy_from_slice(&c0.to_le_bytes());
    out[12..].copy_from_slice(&d0.to_le_bytes());
    out
}
