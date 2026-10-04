"""Import the photographer's 2019 contest and competition pictures as the album `awards`.

Source: his own folder "2019년 전국사진촬영대회 & 공모입상작" on the family's copy of his external drive.
The file names there carry, in his own words, the contest and the title:  이동주<번호>_<대회>_<제목>_<상>.jpg
Three of the 25 files are water-light works already in the Abstract album and are not imported again.
One (C27A0709, "휴식") is a nude study; the family decided not to publish it.

Writes assets/awards/<name>.jpg (long edge 1200 px) and tools/awards.json.
Usage: python tools/import_awards.py "<path to the source folder>"
"""
import io, json, os, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (part of source file name, output name, title ko, title en, contest ko, contest en, level, recognisable people)
WORKS = [
    ('IMG_0692', 'IMG_0692', '초가문짝', 'Door of a Thatched House', '옥천 향수 전국사진공모전', 'Okcheon Hyangsu National Photo Contest', 'selected', False),
    ('C27A1852', 'C27A1852', '호기심', 'Curiosity', '마산 전국사진공모전', 'Masan National Photo Contest', 'selected', False),
    ('C27A2026', 'C27A2026', '계백장군', 'General Gyebaek', '계룡 전국사진공모전', 'Gyeryong National Photo Contest', 'selected', False),
    ('C27A5670', 'C27A5670', '회상', 'Reminiscence', '대구 전국사진공모전', 'Daegu National Photo Contest', 'selected', True),
    ('C27A5694', 'C27A5694', '응시', 'Gaze', '용인 전국사진공모전', 'Yongin National Photo Contest', 'selected', True),
    ('IMG_8833', 'IMG_8833', '다비식', 'Cremation Rite', '진주 전국사진공모전', 'Jinju National Photo Contest', 'selected', True),
    ('C27A1813', 'C27A1813', '은파호수', 'Eunpa Lake', '', '', 'selected', False),
    ('C27A3301', 'C27A3301', '유채밭 향연', 'Feast in the Rapeseed Field', '나주 전국사진촬영대회', 'Naju National Photography Competition', 'selected', False),
    ('장흥공모_유채꽃놀이', 'jangheung-rapeseed', '유채꽃놀이', 'Rapeseed Flower Outing', '장흥 전국사진공모전', 'Jangheung National Photo Contest', 'selected', False),
    ('C27A5134', 'C27A5134', '도령행차', "A Young Master's Procession", '군산 전국사진촬영대회', 'Gunsan National Photography Competition', 'selected', True),
    ('C27A7402', 'C27A7402', '기다림', 'Waiting', '광주 전국사진촬영대회', 'Gwangju National Photography Competition', 'selected', True),
    ('C27A5220', 'C27A5220', '전통무', 'Traditional Dance', '남원 전국사진촬영대회', 'Namwon National Photography Competition', 'selected', True),
    ('C27A8624', 'C27A8624', '바지락 캐는 여인들', 'Women Digging Clams', '아산', 'Asan', 'selected', False),
    ('서천공모_모정', 'seocheon-moorhen', '모정', "A Mother's Love", '서천 전국사진공모전', 'Seocheon National Photo Contest', 'selected', False),
    ('부천공모_산삼채취', 'bucheon-ginseng', '산삼채취', 'Gathering Wild Ginseng', '부천 전국사진공모전', 'Bucheon National Photo Contest', 'selected', True),
    ('목포대회_힘찬 흥', 'mokpo-dance', '힘찬 흥', 'High Spirits', '목포 전국사진촬영대회', 'Mokpo National Photography Competition', 'selected', True),
    ('C27A4100', 'C27A4100', '김제 가래떡 만세', 'Hurrah for the Gimje Rice Cake', '김제 지평선축제 전국사진촬영대회', 'Gimje Horizon Festival National Photography Competition', 'bronze', True),
    ('IMG_6950', 'IMG_6950', '호기심', 'Curiosity', '장흥 전국사진공모전', 'Jangheung National Photo Contest', 'selected', True),
    ('C27A6595', 'C27A6595', '정담', 'A Friendly Chat', '화순 전국사진촬영대회', 'Hwasun National Photography Competition', 'selected', True),
    ('C27A6771', 'C27A6771', '극락왕생하소서', 'May You Be Reborn in Paradise', '안동 전국사진공모전', 'Andong National Photo Contest', 'selected', True),
    ('군산관광_동백대교 야경', 'dongbaek-bridge', '동백대교 야경', 'Dongbaek Bridge at Night', '군산 관광사진 공모전', 'Gunsan Tourism Photo Contest', 'selected', False),
]

if __name__ == '__main__':
    src = sys.argv[1]
    files = os.listdir(src)
    out_dir = os.path.join(ROOT, 'assets', 'awards')
    os.makedirs(out_dir, exist_ok=True)
    rows = []
    for key, name, ko, en, c_ko, c_en, level, people in WORKS:
        match = [f for f in files if key in f]
        assert len(match) == 1, (key, match)
        im = Image.open(os.path.join(src, match[0]))
        exif = im.getexif()
        icc = im.info.get('icc_profile')
        im = ImageOps.exif_transpose(im).convert('RGB')
        if 0x0112 in exif: del exif[0x0112]           # orientation is now baked in
        im.thumbnail((1200, 1200), Image.LANCZOS)
        dst = os.path.join(out_dir, name + '.jpg')
        im.save(dst, quality=90, optimize=True, progressive=True, exif=exif.tobytes(), **({'icc_profile': icc} if icc else {}))
        rows.append(dict(file=name + '.jpg', source=match[0], title_ko=ko, title_en=en, contest_ko=c_ko, contest_en=c_en, level=level, people=people))
        print('%-24s %4dx%-4d %4.0f KB  %s' % (name, im.size[0], im.size[1], os.path.getsize(dst) / 1e3, ko))
    with io.open(os.path.join(ROOT, 'tools', 'awards.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(len(rows), 'works imported')
