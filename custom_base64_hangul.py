"""
custom_base64_hangul.py

- Base64 문자 하나를 '뿡' + (존재하는 한글들만 나열) + '뽕' 으로 인코딩합니다.
- '=' 패딩 문자는 '뿡=뽕' 으로 표현합니다.

Usage:
  python custom_base64_hangul.py encode "hello"
  python custom_base64_hangul.py decode "뿡낑깡뽕뿡...뽕"
  python custom_base64_hangul.py test   # 내장 라운드트립 테스트

원리 요약:
- 6비트 자리(비트5..비트0)에 각각 다음 한글을 매핑:
  ['낑','깡','삐','앙','버','거']  # MSB -> LSB
- 각 Base64 문자(6비트)에 대해 비트가 1인 자리의 한글만 순서대로 출력.
- 각 토큰은 반드시 '뿡' 시작과 '뽕' 종료로 둘러싸여 있어 파싱이 쉽습니다.
"""

import base64
import sys

HANGUL_BITS = ['낑', '깡', '삐', '앙', '버', '거']  # MSB -> LSB (비트 5..0)
BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
START_DELIM = '뿡'
END_DELIM = '뽕'
PADDING_MARKER = '='  # inside delimiter when padding


def bytes_to_custom_tokens(data: bytes) -> str:
    """Encode bytes -> custom token string using delimiters.

    For each Base64 character (including '=' padding):
      • If '=', emit '뿡=뽕'
      • Else compute its 6-bit index and emit '뿡' + concat(present hanguls) + '뽕'
    """
    b64 = base64.b64encode(data).decode('ascii')
    out = []
    for ch in b64:
        if ch == '=':
            out.append(f"{START_DELIM}{PADDING_MARKER}{END_DELIM}")
            continue
        idx = BASE64_ALPHABET.index(ch)
        present = []
        for i, hangul in enumerate(HANGUL_BITS):
            bit = (idx >> (5 - i)) & 1
            if bit:
                present.append(hangul)
        out.append(START_DELIM + ''.join(present) + END_DELIM)
    return ''.join(out)


def custom_tokens_to_bytes(token_str: str) -> bytes:
    """Decode token string -> original bytes.

    Token stream format: sequence of tokens each bounded by START_DELIM and END_DELIM.
    Each token's content is either '=' (padding) or a concatenation of zero-or-more
    HANGUL_BITS characters (in canonical order) representing bits set to 1.
    """
    i = 0
    n = len(token_str)
    b64_chars = []
    while i < n:
        # find start delimiter
        if token_str[i] != START_DELIM:
            raise ValueError(f"Invalid format at pos {i}: expected start delimiter '{START_DELIM}'")
        i += 1
        # find next end delimiter
        j = token_str.find(END_DELIM, i)
        if j == -1:
            raise ValueError(f"Missing end delimiter '{END_DELIM}' after pos {i}")
        content = token_str[i:j]
        i = j + 1
        if content == PADDING_MARKER:
            b64_chars.append('=')
            continue
        # content should be a subset (possibly empty) of HANGUL_BITS
        idx = 0
        for hangul in HANGUL_BITS:
            idx <<= 1
            if hangul in content:
                idx |= 1
        # validate that content contains only allowed hanguls
        for ch in content:
            if ch not in HANGUL_BITS:
                raise ValueError(f"Unknown token character '{ch}' inside token")
        b64_chars.append(BASE64_ALPHABET[idx])
    b64_str = ''.join(b64_chars)
    try:
        return base64.b64decode(b64_str, validate=True)
    except TypeError:
        # older pythons may not support validate keyword
        return base64.b64decode(b64_str)


# Simple CLI for encode/decode/test
def _print_usage_and_exit():
    print("Usage:")
    print("  python custom_base64_hangul.py encode <text-or-hex>")
    print("  python custom_base64_hangul.py decode <token-string>")
    print("  python custom_base64_hangul.py test")
    sys.exit(1)


def _run_tests():
    samples = [b"", b"f", b"fo", b"foo", b"hello world", b"\x00\xff\x10\x20"]
    for s in samples:
        tok = bytes_to_custom_tokens(s)
        back = custom_tokens_to_bytes(tok)
        print(f"sample={s!r}")
        print(f" token={tok}")
        print(f" back={back!r}")
        assert back == s, "roundtrip failed"
    # also test decode of a manually constructed case
    s = b"Base64 test"
    tok = bytes_to_custom_tokens(s)
    back = custom_tokens_to_bytes(tok)
    assert back == s
    print("All tests passed.")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        _print_usage_and_exit()
    cmd = sys.argv[1].lower()
    if cmd == 'encode':
        if len(sys.argv) < 3:
            _print_usage_and_exit()
        arg = sys.argv[2]
        # allow hex: prefix 0x or raw text
        if arg.startswith('0x'):
            data = bytes.fromhex(arg[2:])
        else:
            data = arg.encode('utf-8')
        print(bytes_to_custom_tokens(data))
    elif cmd == 'decode':
        if len(sys.argv) < 3:
            _print_usage_and_exit()
        tok = sys.argv[2]
        data = custom_tokens_to_bytes(tok)
        # print both hex and utf-8 (if decodable)
        print(data.hex())
        try:
            print(data.decode('utf-8'))
        except Exception:
            print('<binary>')
    elif cmd == 'test':
        _run_tests()
    else:
        _print_usage_and_exit()

