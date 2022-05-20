// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

const BOM_CHAR: char = '\u{FEFF}';

pub(crate) fn strip_bom(text: &str) -> &str {
  if text.starts_with(BOM_CHAR) {
    &text[BOM_CHAR.len_utf8()..]
  } else {
    text
  }
}
