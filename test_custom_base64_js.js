const HANGUL_BITS = ['낑', '깡', '삐', '앙', '버', '거'];
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const START_DELIM = '뿡';
const END_DELIM = '뽕';
const PADDING_MARKER = '=';

function bytesToBase64(bytes){
  return Buffer.from(bytes).toString('base64');
}
function base64ToBytes(b64){
  return Buffer.from(b64, 'base64');
}

function bytes_to_custom_tokens(dataBytes){
  const b64 = bytesToBase64(dataBytes);
  let out = '';
  for(const ch of b64){
    if(ch === '='){
      out += START_DELIM + PADDING_MARKER + END_DELIM;
      continue;
    }
    const idx = BASE64_ALPHABET.indexOf(ch);
    if(idx === -1) throw new Error('Unknown base64 char: ' + ch);
    let present = '';
    for(let i=0;i<HANGUL_BITS.length;i++){
      const bit = (idx >> (5 - i)) & 1;
      if(bit) present += HANGUL_BITS[i];
    }
    out += START_DELIM + present + END_DELIM;
  }
  return out;
}

function custom_tokens_to_bytes(tokenStr){
  let i = 0, n = tokenStr.length;
  let b64_chars = [];
  while(i < n){
    if(tokenStr[i] !== START_DELIM) throw new Error(`Invalid format at pos ${i}: expected '${START_DELIM}'`);
    i++;
    const j = tokenStr.indexOf(END_DELIM, i);
    if(j === -1) throw new Error(`Missing end delimiter '${END_DELIM}' after pos ${i}`);
    const content = tokenStr.slice(i, j);
    i = j + 1;
    if(content === PADDING_MARKER){ b64_chars.push('='); continue; }
    for(const ch of content){ if(!HANGUL_BITS.includes(ch)) throw new Error(`Unknown token character '${ch}' inside token`); }
    let idx = 0;
    for(const hangul of HANGUL_BITS){ idx = (idx << 1) | (content.includes(hangul) ? 1 : 0); }
    b64_chars.push(BASE64_ALPHABET[idx]);
  }
  const b64str = b64_chars.join('');
  return base64ToBytes(b64str);
}

function toHex(buf){
  return Buffer.from(buf).toString('hex');
}

function runTests(){
  const samples = [Buffer.from([]), Buffer.from('f'), Buffer.from('fo'), Buffer.from('foo'), Buffer.from('hello world'), Buffer.from([0x00,0xff,0x10,0x20])];
  for(const s of samples){
    const tok = bytes_to_custom_tokens(s);
    const back = custom_tokens_to_bytes(tok);
    const backHex = toHex(back);
    const origHex = toHex(s);
    console.log('sample hex:', origHex);
    console.log(' token:', tok);
    console.log(' back hex:', backHex);
    if(backHex !== origHex){
      console.error('ROUNDTRIP FAILED for sample', origHex);
      process.exit(2);
    }
  }
  console.log('All tests passed.');
}

runTests();

