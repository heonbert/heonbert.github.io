"""Write the photographer's name, the licence and the title into every published photograph, without touching the picture.

For each JPEG in assets/<album>/ that is in the catalogue (and the four album covers):
  - EXIF Artist and Copyright are set; everything the camera wrote (date, lens, exposure) is kept
  - the XMP packet is replaced by a short one: creator, credit, rights, titles in Korean and English,
    and, for pictures offered for free reuse, the CC BY 4.0 licence and where to read it
  - Photoshop's private blocks and editing history are dropped (they held a personal e-mail address)
The compressed image data is copied byte for byte, so nothing is re-encoded. Running it again changes nothing.
Usage: python tools/embed_metadata.py [--check]
"""
import io, json, os, re, struct, sys
from xml.sax.saxutils import escape
import piexif

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIST = 'Yumok Lee Dong-joo'
COPYRIGHT = 'Yumok Lee Dong-joo (1952-2024). CC BY 4.0. https://seungheon.com/'
COPYRIGHT_PEOPLE = 'Yumok Lee Dong-joo (1952-2024). https://seungheon.com/license.html'
CC = 'https://creativecommons.org/licenses/by/4.0/'
LICENSE_PAGE = 'https://seungheon.com/en/license.html'
XMP_HEAD = b'http://ns.adobe.com/xap/1.0/\x00'
MAIL = re.compile(rb'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}')


def split(data):
    """Header segments of a JPEG as [(marker, payload)], and the offset where image data starts."""
    assert data[:2] == b'\xff\xd8', 'not a JPEG'
    i, out = 2, []
    while True:
        assert data[i] == 0xFF
        m = data[i + 1]
        if m == 0xDA: return out, i
        n = struct.unpack('>H', data[i + 2:i + 4])[0]
        out.append((m, data[i + 4:i + 2 + n]))
        i += 2 + n


def xmp_packet(p):
    alt = lambda items: '<rdf:Alt>%s</rdf:Alt>' % ''.join('<rdf:li xml:lang="%s">%s</rdf:li>' % (l, escape(t)) for l, t in items)
    free = p is None or not p['people']
    rights = 'Photograph by Yumok (流木) Lee Dong-joo (이동주, 1952-2024).' + (' Licensed under CC BY 4.0. Credit the photographer and link to https://seungheon.com/' if free
              else ' People shown have rights over their own image. See https://seungheon.com/license.html')
    parts = [
        '<dc:creator><rdf:Seq><rdf:li>Yumok (流木) Lee Dong-joo</rdf:li></rdf:Seq></dc:creator>',
        '<dc:rights>%s</dc:rights>' % alt([('x-default', rights)]),
        '<photoshop:Credit>Yumok (流木) Lee Dong-joo</photoshop:Credit>',
        '<photoshop:Source>https://seungheon.com/</photoshop:Source>',
        '<xmpRights:Marked>True</xmpRights:Marked>',
        '<xmpRights:WebStatement>%s</xmpRights:WebStatement>' % LICENSE_PAGE,
        '<cc:attributionName>Yumok (流木) Lee Dong-joo</cc:attributionName>',
    ]
    if p is not None:
        parts.append('<dc:title>%s</dc:title>' % alt([('x-default', p['title']['en']), ('en', p['title']['en']), ('ko', p['title']['ko'])]))
        parts.append('<dc:identifier>%s</dc:identifier>' % escape(p['id']))
        parts.append('<cc:attributionURL>%s</cc:attributionURL>' % escape(p['page']))
        note = 'Title given by the photographer.' if p['title_by'] == 'yumok' else 'The title is a description written by an AI after the photographer\'s death; it is not his own.'
        if p.get('award'): note += ' ' + p['award'] + '.'
        parts.append('<dc:description>%s</dc:description>' % alt([('x-default', note)]))
    if free:
        parts.append('<xmpRights:UsageTerms>%s</xmpRights:UsageTerms>' % alt([('x-default', 'Creative Commons Attribution 4.0 International (CC BY 4.0). Free to use, including for AI training, with credit to Yumok (流木) Lee Dong-joo.')]))
        parts.append('<cc:license rdf:resource="%s"/>' % CC)
        parts.append('<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource"><plus:LicensorURL>%s</plus:LicensorURL></rdf:li></rdf:Seq></plus:Licensor>' % LICENSE_PAGE)
    body = ('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
            '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" '
            'xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:cc="http://creativecommons.org/ns#" xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/">'
            + ''.join(parts) + '</rdf:Description></rdf:RDF></x:xmpmeta>')
    return ('<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' + body + '<?xpacket end="w"?>').encode('utf-8')


def exif_fields(p):
    free = p is None or not p['people']
    return ARTIST.encode('ascii'), (COPYRIGHT if free else COPYRIGHT_PEOPLE).encode('ascii')


def safe_dump(ex):
    """piexif cannot write back a few unusual tags; if it fails, those are found one by one and left out."""
    try:
        return pad(piexif.dump(ex), ex)
    except Exception:
        for ifd in ('0th', 'Exif', 'GPS'):
            for tag in list(ex.get(ifd) or {}):
                try: piexif.dump({'0th': {}, 'Exif': {}, 'GPS': {}, ifd: {tag: ex[ifd][tag]}})
                except Exception: del ex[ifd][tag]
        return pad(piexif.dump(ex), ex)


def pad(payload, ex):
    """Without a thumbnail the last directory ends the block; four spare bytes keep strict readers from running off the end."""
    return payload if ex.get('thumbnail') else payload + bytes(4)


def rewrite(data, p):
    segs, sos = split(data)
    out, has_exif = [], False
    size = next(((struct.unpack('>H', b[3:5])[0], struct.unpack('>H', b[1:3])[0]) for m, b in segs if m in (0xC0, 0xC1, 0xC2)), None)
    artist, copyright_ = exif_fields(p)
    for m, body in segs:
        if m == 0xE1 and body.startswith(b'Exif\x00\x00'):
            ex = piexif.load(body)
            ex['0th'][piexif.ImageIFD.Artist] = artist
            ex['0th'][piexif.ImageIFD.Copyright] = copyright_
            ex['0th'].pop(0x9C9D, None)                     # XPAuthor, a Windows copy of the old author field
            if size and piexif.ExifIFD.PixelXDimension in ex['Exif']:            # a resized copy must not claim the old size
                ex['Exif'][piexif.ExifIFD.PixelXDimension], ex['Exif'][piexif.ExifIFD.PixelYDimension] = size
            new = safe_dump(ex)
            assert not MAIL.search(new), 'an address remains in EXIF'
            out.append((m, new)); has_exif = True
        elif m == 0xE1 and (body.startswith(XMP_HEAD) or body.startswith(b'http://ns.adobe.com/xmp/extension/')):
            continue                                        # replaced below
        elif m == 0xED:
            continue                                        # Photoshop's private block
        else:
            out.append((m, body))
    if not has_exif:
        ex = {'0th': {piexif.ImageIFD.Artist: artist, piexif.ImageIFD.Copyright: copyright_}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': None}
        out.insert(1 if out and out[0][0] == 0xE0 else 0, (0xE1, piexif.dump(ex)))
    # the XMP packet goes right after EXIF
    at = next(i for i, (m, b) in enumerate(out) if m == 0xE1 and b.startswith(b'Exif\x00\x00')) + 1
    out.insert(at, (0xE1, XMP_HEAD + xmp_packet(p)))
    buf = io.BytesIO()
    buf.write(b'\xff\xd8')
    for m, body in out:
        assert len(body) + 2 <= 0xFFFF, 'segment too large'
        buf.write(bytes([0xFF, m]) + struct.pack('>H', len(body) + 2) + body)
    buf.write(data[sos:])
    return buf.getvalue(), data[sos:]


def main(check=False):
    cat = json.load(io.open(os.path.join(ROOT, 'data', 'photos.json'), encoding='utf-8'))['photos']
    jobs = [(p['file'], p) for p in cat] + [('assets/%s/cover.jpg' % a, None) for a in ('abstract', 'reflection', 'pattern', 'landscape')]
    changed = 0
    for rel, p in jobs:
        path = os.path.join(ROOT, rel)
        data = open(path, 'rb').read()
        new, scan = rewrite(data, p)
        assert new.endswith(scan) and not MAIL.search(new[:len(new) - len(scan)]), rel
        if new != data:
            changed += 1
            if not check:
                with open(path, 'wb') as f: f.write(new)
    print('%d files, %d %s' % (len(jobs), changed, 'would change' if check else 'rewritten'))
    return changed


if __name__ == '__main__':
    n = main(check='--check' in sys.argv)
    sys.exit(1 if n and '--check' in sys.argv else 0)
