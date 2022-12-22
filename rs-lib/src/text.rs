// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.

const BOM_CHAR: char = '\u{FEFF}';

/// Strips the byte order mark from the provided text if it exists.
pub fn strip_bom(text: &str) -> &str {
  if text.starts_with(BOM_CHAR) {
    &text[BOM_CHAR.len_utf8()..]
  } else {
    text
  }
}

pub fn transform_json_source(source: &str) -> String {
  // Make sure to trim all redundant training newlines,
  // and escape all reserved characters per JSON RFC,
  // https://www.rfc-editor.org/rfc/rfc8259
  let escaped = escape8259::escape(source.trim_end());
  format!(r#"export default JSON.parse("{escaped}");"#)
}

#[cfg(test)]
mod test {
  use super::*;

  #[test]
  fn strip_bom_with_bom() {
    let text = format!("{}text", BOM_CHAR);
    assert_eq!(strip_bom(&text), "text");
  }

  #[test]
  fn strip_bom_without_bom() {
    let text = "text";
    assert_eq!(strip_bom(text), "text");
  }

  #[test]
  fn transform_json_source_simple() {
    let text = r#"{"foo": "bar"}"#;
    assert_eq!(transform_json_source(text), r#"export default JSON.parse("{\"foo\": \"bar\"}");"#);
  }

  #[test]
  fn transform_json_source_escape_newline() {
    let text = r#"{"foo": "bar\nbaz"}"#;
    assert_eq!(transform_json_source(text), r#"export default JSON.parse("{\"foo\": \"bar\\nbaz\"}");"#);
  }

  #[test]
  fn transform_json_source_escape_quotes() {
    let text = r#"{"foo": "bar \"baz\" 'qux' `quaz`"}"#;
    assert_eq!(transform_json_source(text), r#"export default JSON.parse("{\"foo\": \"bar \\\"baz\\\" 'qux' `quaz`\"}");"#);
  }

  #[test]
  fn transform_json_source_not_escape_string_interpolation() {
    let text = r#"{"foo": "bar ${baz}"}"#;
    assert_eq!(transform_json_source(text), r#"export default JSON.parse("{\"foo\": \"bar ${baz}\"}");"#);
  }
}
