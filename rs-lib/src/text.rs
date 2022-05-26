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
}
