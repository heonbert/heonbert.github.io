"""Derive a place name for each photo from the photographer's own shooting-folder names.

Input : a JSON map {photo n: "2019_01_23심포항 물빛촬영(3)"} (folder names from his external drive)
Output: tools/places.json  {n: {folder, place, place_en}}
Usage : python tools/build_places.py path/to/shoot_folder.json
"""
import io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Photos whose shooting date had more than one folder; resolved by file number and subject.
MANUAL = {
    22: '2020_02_27심포항 물빛(만경강하구)(11)',
    190: '2018_10_11월명호수 물빛 촬영(1)',
    191: '2019_01_25완주 대아저수지 물빛촬영',
    193: '2018_10_18은파호수 물빛촬영(2)',
    230: '2018_11_10은파호수 물빛촬영(5)',
}

# (pattern in folder name, place in Korean, place in English) - first match wins.
RULES = [
    ('심포항', '김제 심포항', 'Simpo Port, Gimje'),
    ('가력도', '새만금 가력도항', 'Garyeokdo Port, Saemangeum'),
    ('은파', '군산 은파호수', 'Eunpa Lake, Gunsan'),
    ('월명호수', '군산 월명호수', 'Wolmyeong Lake, Gunsan'),
    ('구절초', '정읍 구절초 테마공원', 'Gujeolcho Theme Park, Jeongeup'),
    ('궁남지', '부여 궁남지', 'Gungnamji Pond, Buyeo'),
    ('사선대', '임실 관촌 사선대', 'Saseondae, Imsil'),
    ('마곡사', '공주 마곡사', 'Magoksa Temple, Gongju'),
    ('장항송림|장항 송림', '서천 장항 송림', 'Janghang Pine Forest, Seocheon'),
    ('군산내항 및 장항|내항 및 장항', '군산 내항·서천 장항', 'Gunsan Inner Harbor and Janghang'),
    ('장항', '서천 장항항', 'Janghang Port, Seocheon'),
    ('내항|역사박물관', '군산 내항', 'Gunsan Inner Harbor'),
    ('군장항', '군산 군장항', 'Gunjang Port, Gunsan'),
    ('비응항', '군산 비응항', 'Bieung Port, Gunsan'),
    ('토옥', '장수 토옥동 계곡', 'Tookdong Valley, Jangsu'),
    ('대아', '완주 대아저수지', 'Daea Reservoir, Wanju'),
    ('진봉', '김제 진봉 농수로', 'Jinbong irrigation canal, Gimje'),
    ('부안댐', '부안댐', 'Buan Dam'),
    ('내변산', '부안 내변산', 'Naebyeonsan, Buan'),
    ('탑정호', '논산 탑정호', 'Tapjeong Lake, Nonsan'),
    ('생태원', '서천 국립생태원', 'National Institute of Ecology, Seocheon'),
    ('정읍천', '정읍천', 'Jeongeupcheon Stream, Jeongeup'),
    ('하구둑', '금강하구둑', 'Geum River Estuary Bank'),
    ('전주 수목원', '전주 수목원', 'Jeonju Arboretum'),
    ('선유도', '군산 선유도', 'Seonyudo Island, Gunsan'),
    ('웅포', '익산 웅포대교', 'Ungpo Bridge, Iksan'),
    ('신성리', '서천 신성리 갈대밭', 'Sinseong-ri Reed Field, Seocheon'),
    ('줄포만', '부안 줄포만 생태공원', 'Julpo Bay Ecological Park, Buan'),
    ('망해사', '김제 망해사', 'Manghaesa Temple, Gimje'),
    ('내소사', '부안 내소사', 'Naesosa Temple, Buan'),
    ('벽골제', '김제 벽골제', 'Byeokgolje, Gimje'),
    ('붕어섬', '임실 옥정호 붕어섬', 'Bungeoseom, Okjeong Lake, Imsil'),
    ('만경강', '만경강 하구', 'Mangyeong River estuary'),
    ('변산해수욕장', '부안 변산해수욕장', 'Byeonsan Beach, Buan'),
    ('만경호수', '김제 만경호수', 'Mangyeong Lake, Gimje'),
    ('괴정저수지', '증평 괴정저수지', 'Goejeong Reservoir, Jeungpyeong'),
    ('동림저수지', '고창 동림저수지', 'Dongnim Reservoir, Gochang'),
    ('천장호', '청양 천장호 출렁다리', 'Cheonjang Lake Suspension Bridge, Cheongyang'),
    ('군산', '군산', 'Gunsan'),
]

src = json.load(io.open(sys.argv[1], encoding='utf-8'))
folders = {int(k): v for k, v in src.items()}
folders.update(MANUAL)

out, unmapped = {}, set()
for n, folder in folders.items():
    name = re.sub(r'^\d{4}_\d{2}_\d{2}\s*', '', folder)
    entry = {'folder': folder}
    for pat, ko, en in RULES:
        if re.search(pat, name):
            entry.update(place=ko, place_en=en)
            break
    else:
        unmapped.add(name)
    out[n] = entry

with io.open(os.path.join(ROOT, 'tools', 'places.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=0, sort_keys=True)
print(len(out), 'with folder;', sum('place' in v for v in out.values()), 'with place; unmapped:', sorted(unmapped))
