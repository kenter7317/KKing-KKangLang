    const HANGUL_BITS = ['낑', '깡', '삐', '앙', '버', '거'];
    const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const START_DELIM = '뿡';
    const END_DELIM = '뽕';
    const PADDING_MARKER = '=';

    function utf8ToBytes(str) { return new TextEncoder().encode(str); }
    function bytesToUtf8(bytes) { try { return new TextDecoder().decode(bytes); } catch(e) { return null; } }

    function bytesToBase64(bytes){
      let binary = '';
      for(let i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    function base64ToBytes(b64){
      const binary = atob(b64);
      const arr = new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++) arr[i] = binary.charCodeAt(i);
      return arr;
    }

    function bytes_to_custom_tokens(dataBytes){
      const b64 = bytesToBase64(dataBytes);
      let out = '';
      for(const ch of b64){
        if(ch === '='){ out += START_DELIM + PADDING_MARKER + END_DELIM; continue; }
        const idx = BASE64_ALPHABET.indexOf(ch);
        if(idx === -1) { console.error('Unknown base64 char:', ch); return ''; }
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
        if(tokenStr[i] !== START_DELIM) { console.error(`Invalid format at pos ${i}: expected '${START_DELIM}'`); return null; }
        i++;
        const j = tokenStr.indexOf(END_DELIM, i);
        if(j === -1) { console.error(`Missing end delimiter '${END_DELIM}' after pos ${i}`); return null; }
        const content = tokenStr.slice(i, j);
        i = j + 1;
        if(content === PADDING_MARKER){ b64_chars.push('='); continue; }
        for(const ch of content){ if(!HANGUL_BITS.includes(ch)) { console.error(`Unknown token character '${ch}' inside token`); return null; } }
        let idx = 0;
        for(const hangul of HANGUL_BITS){ idx = (idx << 1) | (content.includes(hangul) ? 1 : 0); }
        b64_chars.push(BASE64_ALPHABET[idx]);
      }
      const b64str = b64_chars.join('');
      return base64ToBytes(b64str);
    }

    document.getElementById('pycode').textContent = `// JavaScript implementation\n// HANGUL_BITS = ${JSON.stringify(HANGUL_BITS)}`;

    document.getElementById('run').addEventListener('click', ()=>{
      const mode = document.getElementById('mode').value;
      const input = document.getElementById('input').value;
      const outEl = document.getElementById('output');
      outEl.textContent = '실행 중...';
      try{
        if(mode === 'encode'){
          if(input.includes(START_DELIM) && input.includes(END_DELIM)){
            outEl.textContent = '오류: 이미 인코딩된 문자열로 보입니다. 다시 인코딩할 수 없습니다.';
            return;
          }
          const bytes = utf8ToBytes(input);
          outEl.textContent = bytes_to_custom_tokens(bytes);
        } else {
          const bytes = custom_tokens_to_bytes(input);
          if(bytes === null){ outEl.textContent = '오류: 잘못된 토큰 형식입니다.'; return; }
          const hex = Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
          const text = bytesToUtf8(bytes);
          outEl.textContent = `hex: ${hex}\ntext: ${text === null ? '<binary>' : text}`;
        }
      }catch(e){ outEl.textContent = '오류: ' + e.toString(); }
    });

    document.getElementById('run-test').addEventListener('click', ()=>{
      const outEl = document.getElementById('output');
      outEl.textContent = '테스트 실행 중...';
      try{
        const samples = [new Uint8Array([]), new TextEncoder().encode('f'), new TextEncoder().encode('fo'), new TextEncoder().encode('foo'), new TextEncoder().encode('hello world'), new Uint8Array([0x00,0xff,0x10,0x20])];
        let lines = [];
        let ok = true;
        for(const s of samples){
          const tok = bytes_to_custom_tokens(s);
          const back = custom_tokens_to_bytes(tok);
          const origHex = Array.from(s).map(b=>b.toString(16).padStart(2,'0')).join('');
          if(back === null){
            lines.push(`orig(hex): ${origHex} \n token: ${tok} \n error: token parse failed`);
            ok = false;
            break;
          }
          const backHex = Array.from(back).map(b=>b.toString(16).padStart(2,'0')).join('');
          const origText = bytesToUtf8(s) === null ? '<binary>' : bytesToUtf8(s);
          lines.push(`orig: ${origText}\n token: ${tok}\n back(hex): ${backHex}\n`);
          if(backHex !== origHex){
            lines.push(`roundtrip mismatch: expected ${origHex} but got ${backHex}`);
            ok = false;
            break;
          }
        }
        if(ok) lines.push('All tests passed.');
        outEl.textContent = lines.join('\n');
      }catch(e){ outEl.textContent = '테스트 실패: ' + e.toString(); }
    });

    document.getElementById('copy-output').addEventListener('click', async ()=>{
      const out = document.getElementById('output').textContent;
      try{ await navigator.clipboard.writeText(out); alert('출력이 클립보드에 복사되었습니다.'); }
      catch(e){ alert('복사 실패: ' + e); }
    });