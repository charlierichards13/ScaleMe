//! Output types. They serialize to exactly the v0.1 `Resume` contract in `docs/api-contract.md`
//! (`{ id, filename?, text, sections? }`); nothing else is ever emitted.

use crate::limits::{
    utf16_len, MAX_FILENAME_UTF16, MAX_HEADING_UTF16, MAX_ID_UTF16, MAX_SECTIONS, MAX_TEXT_UTF16,
};
use serde::{Deserialize, Serialize};

/// `{ "resume": Resume }`, the success body of the proposed `POST /api/resume/parse`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResumeEnvelope {
    pub resume: Resume,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Resume {
    /// Opaque, request-specific id. Never derived from the file name or content.
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub filename: Option<String>,
    /// All reliably extracted text, in reading order, one visual line per `\n`.
    pub text: String,
    /// Present only when headings were detected with enough evidence.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sections: Option<Vec<ResumeSection>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResumeSection {
    pub heading: String,
    pub text: String,
}

/// A violation of the v0.1 `ResumeSchema` limits.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContractViolation {
    Id,
    Filename,
    TextEmpty,
    TextTooLong,
    TooManySections,
    HeadingTooLong,
    SectionTextTooLong,
}

impl Resume {
    /// Check the same limits as `ResumeSchema` (Zod) so a value that passes here is accepted
    /// by `POST /api/fit/analyze` unchanged.
    pub fn check_contract(&self) -> Result<(), ContractViolation> {
        let id_len = utf16_len(&self.id);
        if id_len == 0 || id_len > MAX_ID_UTF16 {
            return Err(ContractViolation::Id);
        }
        if let Some(name) = &self.filename {
            if utf16_len(name) > MAX_FILENAME_UTF16 {
                return Err(ContractViolation::Filename);
            }
        }
        if self.text.trim().is_empty() {
            return Err(ContractViolation::TextEmpty);
        }
        if utf16_len(self.text.trim()) > MAX_TEXT_UTF16 {
            return Err(ContractViolation::TextTooLong);
        }
        if let Some(sections) = &self.sections {
            if sections.len() > MAX_SECTIONS {
                return Err(ContractViolation::TooManySections);
            }
            for s in sections {
                if utf16_len(&s.heading) > MAX_HEADING_UTF16 {
                    return Err(ContractViolation::HeadingTooLong);
                }
                if utf16_len(&s.text) > MAX_TEXT_UTF16 {
                    return Err(ContractViolation::SectionTextTooLong);
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Resume {
        Resume {
            id: "resume-demo-001".into(),
            filename: Some("synthetic-resume.pdf".into()),
            text: "EDUCATION\nB.S. Computer Science\nSKILLS\nPython, SQL".into(),
            sections: Some(vec![
                ResumeSection {
                    heading: "Education".into(),
                    text: "B.S. Computer Science".into(),
                },
                ResumeSection {
                    heading: "Skills".into(),
                    text: "Python, SQL".into(),
                },
            ]),
        }
    }

    #[test]
    fn serializes_to_the_documented_example() {
        let json = serde_json::to_value(ResumeEnvelope { resume: sample() }).unwrap();
        let expected: serde_json::Value = serde_json::from_str(
            r#"{
              "resume": {
                "id": "resume-demo-001",
                "filename": "synthetic-resume.pdf",
                "text": "EDUCATION\nB.S. Computer Science\nSKILLS\nPython, SQL",
                "sections": [
                  { "heading": "Education", "text": "B.S. Computer Science" },
                  { "heading": "Skills", "text": "Python, SQL" }
                ]
              }
            }"#,
        )
        .unwrap();
        assert_eq!(json, expected);
    }

    #[test]
    fn optional_fields_are_omitted_not_null() {
        let mut r = sample();
        r.filename = None;
        r.sections = None;
        let json = serde_json::to_value(&r).unwrap();
        let keys: Vec<&String> = json.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["id", "text"]);
    }

    #[test]
    fn contract_limits_are_enforced() {
        assert_eq!(sample().check_contract(), Ok(()));

        let mut r = sample();
        r.id = String::new();
        assert_eq!(r.check_contract(), Err(ContractViolation::Id));
        r.id = "x".repeat(101);
        assert_eq!(r.check_contract(), Err(ContractViolation::Id));

        let mut r = sample();
        r.filename = Some("f".repeat(256));
        assert_eq!(r.check_contract(), Err(ContractViolation::Filename));

        let mut r = sample();
        r.text = " \n ".into();
        assert_eq!(r.check_contract(), Err(ContractViolation::TextEmpty));
        r.text = "a".repeat(30_000);
        assert_eq!(r.check_contract(), Ok(()));
        r.text = "a".repeat(30_001);
        assert_eq!(r.check_contract(), Err(ContractViolation::TextTooLong));
        // 15,001 emoji are 30,002 UTF-16 units even though they are only 15,001 chars.
        r.text = "\u{1f680}".repeat(15_001);
        assert_eq!(r.check_contract(), Err(ContractViolation::TextTooLong));

        let mut r = sample();
        r.sections = Some(vec![
            ResumeSection {
                heading: "h".into(),
                text: "t".into()
            };
            51
        ]);
        assert_eq!(r.check_contract(), Err(ContractViolation::TooManySections));

        let mut r = sample();
        r.sections.as_mut().unwrap()[0].heading = "h".repeat(201);
        assert_eq!(r.check_contract(), Err(ContractViolation::HeadingTooLong));
    }
}
