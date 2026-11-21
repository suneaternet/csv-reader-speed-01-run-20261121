// Fast csv-reader 1.0.0 drop-in: the same reading of {text, header} as make.fun's own
// csv-reader 1.0.0, answered as {columns, rows, errors}, but read with indexOf jumps
// and one slice per field instead of one character at a time.
//
// The reading, exactly as the reference (vendor/csv-reader/index.js in the kit):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (error stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it one quote and each CRLF or lone CR inside it read as LF; what
//     follows its closing quote, up to the next comma or line break, is appended as
//     it stands (quote_junk, when the field ends); a quote that never closes is a
//     literal character, and the text after it is read again as unquoted
//     (unterminated_quote); a quote inside an unquoted field is a literal character;
//   - fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it (every record when header is false), each padded with empty
//     strings (short_row, with fields: its field count) or cut (long_row, with
//     extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met, a record's short_row or
//     long_row when it ends: line the 1-based line its record starts on, counting
//     every LF, CRLF and lone CR inside quotes, and row its record's index in rows,
//     null for the header.
//
// A field read returns its string and sets fEnded (how it ended: 0 comma, 1 line
// break, 2 end of text) and fAdded (the characters kept after the value it was
// given), so no result object is built per field. Pure: no clock, no randomness,
// no locale, nothing kept from one call to the next. No writes anywhere; the
// answer is built in memory and returned.

/** How a field ended: 0 at a comma (the record goes on), 1 at a line break, 2 at the end of the text. */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The last field read: how it ended and the characters it kept after the value it was given.
  let fEnded = END;
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `init` up to the next comma or line break, and returns the field. A field
  // ends at the first comma or LF, so it is one slice; a CR inside it is either the CRLF that ends the line
  // (the slice's last character, when the field ends at a line break) or a lone CR, which is dropped (stray_cr).
  function readUnquoted(init) {
    const c = text.indexOf(',', pos);
    const l = text.indexOf('\n', pos);
    let end;
    let ended;
    if (c !== -1 && (l === -1 || c < l)) {
      end = c;
      ended = COMMA;
    } else if (l !== -1) {
      end = l;
      ended = LINE_BREAK;
    } else {
      end = n;
      ended = END;
    }
    let v = text.slice(pos, end);
    if (v.indexOf('\r') !== -1) {
      let s = v;
      if (ended === LINE_BREAK && s.charCodeAt(s.length - 1) === 13) s = s.slice(0, -1);
      if (s.indexOf('\r') !== -1) {
        let out = '';
        let p = 0;
        for (;;) {
          const ri = s.indexOf('\r', p);
          if (ri === -1) {
            out += s.slice(p);
            break;
          }
          error('stray_cr');
          out += s.slice(p, ri);
          p = ri + 1;
        }
        s = out;
      }
      v = s;
    }
    fAdded = v.length;
    fEnded = ended;
    if (ended === COMMA) pos = end + 1;
    else if (ended === LINE_BREAK) {
      pos = end + 1;
      line += 1;
    } else {
      pos = n;
    }
    return init === '' ? v : init + v;
  }

  // Reads a quoted field whose opening quote is at pos, and returns the field.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote: the next quote that is not doubled.
    let q = pos + 1;
    let closed = -1;
    let hasDoubled = false;
    for (;;) {
      const cand = text.indexOf('"', q);
      if (cand === -1) break;
      if (text.charCodeAt(cand + 1) === 34) {
        hasDoubled = true;
        q = cand + 2;
        continue;
      }
      closed = cand;
      break;
    }
    if (closed === -1) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    // The interior, [open + 1, closed): each CRLF or lone CR in it reads as LF, "" reads as one quote.
    const interior = text.slice(open + 1, closed);
    let value;
    if (!hasDoubled && interior.indexOf('\r') === -1) {
      value = interior;
      let p = 0;
      for (;;) {
        const nl = interior.indexOf('\n', p);
        if (nl === -1) break;
        line += 1;
        p = nl + 1;
      }
    } else {
      let v = interior;
      if (v.indexOf('\r') !== -1) v = v.replace(/\r\n?/g, '\n');
      if (hasDoubled) v = v.replaceAll('""', '"');
      value = v;
      let p = 0;
      for (;;) {
        const nl = v.indexOf('\n', p);
        if (nl === -1) break;
        line += 1;
        p = nl + 1;
      }
    }
    pos = closed + 1;
    if (pos >= n) {
      fEnded = END;
      fAdded = 0;
      return value;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fEnded = COMMA;
      fAdded = 0;
      return value;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return value;
    }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fEnded = LINE_BREAK;
      fAdded = 0;
      return value;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    const junk = readUnquoted(value);
    if (fAdded > 0) error('quote_junk');
    return junk;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      fields.push(quoted ? readQuoted() : readUnquoted(''));
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
