"""One-time, reproducible extraction of blue room overlays from the original JPEGs.

Run with Pillow, numpy and scipy installed. Output is subsequently reviewed against
all 11 unedited source plans. The browser has no Python/runtime dependencies.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
rooms = json.loads((ROOT / 'tools/room-sources.json').read_text())
floors = []
spaces = []
converted = []
report = []
for building, prefix, count in [('Primary Building', 'p', 4), ('Main Building', 'm', 7)]:
    for level in range(1, count + 1):
        floor_id = f'{prefix}{level}'
        source = f'LFP 26-27/{building}/Unedited/Level {level}.jpg'
        image = Image.open(ROOT / source)
        floor = {'id': floor_id, 'buildingId': prefix, 'name': f'Level {level}', 'order': level,
                 'width': 1000, 'height': round(image.height / image.width * 1000),
                 'sourceImage': source, 'spaces': [], 'markers': []}
        gray = np.asarray(image.convert('L'))
        walls = ndimage.binary_closing(gray < 150, structure=np.ones((3,3)))
        regions, _ = ndimage.label(~walls)
        region_sizes = np.bincount(regions.ravel())
        objects = ndimage.find_objects(regions)
        enclosed = {i: sl for i,sl in enumerate(objects,1) if sl and region_sizes[i] > 3000
                    and sl[0].start > 0 and sl[1].start > 0
                    and sl[0].stop < gray.shape[0] and sl[1].stop < gray.shape[1]}
        used = set()
        def region_bounds(sl):
            return [round(sl[1].start/gray.shape[1]*1000), round(sl[0].start/gray.shape[0]*floor['height']),
                    round(sl[1].stop/gray.shape[1]*1000), round(sl[0].stop/gray.shape[0]*floor['height'])]
        def rectangle(b):
            x1,y1,x2,y2 = b
            return [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        for room in [r for r in rooms if r['id'].split('-')[0] == floor_id]:
            a = np.asarray(Image.open(ROOT / room['img']).convert('RGB')).astype(int)
            mask = (a[:, :, 2] - a[:, :, 0] > 35) & (a[:, :, 1] - a[:, :, 0] > 5)
            labels, n = ndimage.label(mask)
            sizes = np.bincount(labels.ravel())
            sizes[0] = 0
            component = labels == sizes.argmax()
            ys, xs = np.where(component)
            if len(xs) < 500:
                raise ValueError(f'No reliable overlay for {room["id"]}')
            x1, x2 = round(xs.min() / a.shape[1] * 1000), round((xs.max()+1) / a.shape[1] * 1000)
            y1, y2 = round(ys.min() / a.shape[0] * floor['height']), round((ys.max()+1) / a.shape[0] * floor['height'])
            points = [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
            # Match the overlay to an enclosed white region, then snap to actual
            # source walls. This corrects drift in the manually highlighted JPEGs.
            resized = np.asarray(Image.open(ROOT / room['img']).convert('RGB').resize(image.size)).astype(int)
            blue = (resized[:,:,2]-resized[:,:,0] > 35) & (resized[:,:,1]-resized[:,:,0] > 5)
            votes = np.bincount(regions[blue], minlength=len(region_sizes))
            region = max(enclosed, key=lambda i: votes[i])
            confidence = votes[region] / max(1,blue.sum())
            if confidence < 0.65:
                raise ValueError(f'Needs manual review: {room["id"]}')
            used.add(region)
            points = rectangle(region_bounds(enclosed[region]))
            # Reviewed concave outlines; keep corridors and recesses intact.
            if room['id'] == 'm3-10':
                points = [[324,134],[403,134],[403,731],[678,731],[678,931],[80,931],[80,678],[324,678]]
            if room['id'] == 'm7-3':
                points = [[46,154],[697,154],[697,432],[395,432],[395,622],[697,622],[697,658],[370,658],[370,939],[46,939]]
            space = {'id': f'space-{room["id"]}', 'label': room.get('roomNum', room['name']),
                     'kind': 'room', 'points': points}
            if room['id'] == 'm3-10': space['labelPoint'] = [350,824]
            if room['id'] == 'm7-3': space['labelPoint'] = [230,390]
            floor['spaces'].append(space)
            converted.append({'id': room['id'], 'name': room['name'],
                              'category': room.get('subCat', room['cat']),
                              'tags': room.get('tags', ''), 'spaceId': space['id']})
            report.append({'room': room['id'], 'name': room['name'], 'floor': floor_id,
                           'sourceImage': room['img'], 'wallMatch': round(float(confidence),3),
                           'bounds': [x1,y1,x2,y2], 'fill': round(float(len(xs)/((xs.max()-xs.min()+1)*(ys.max()-ys.min()+1))),3)})
        for region, sl in enclosed.items():
            if region in used: continue
            bounds = region_bounds(sl)
            # Hatched unknown area and a footer legend are not rooms.
            if floor_id == 'm1' and bounds[0] < 375 and bounds[1] < 930: continue
            if floor_id == 'm7' and bounds[1] > 1260: continue
            lift = prefix == 'm' and level <= 6 and 350 < bounds[0] < 420 and 500 < bounds[1] < 620 and bounds[3] < 735
            floor['spaces'].append({'id':f'{floor_id}-structure-{region}', 'label':'Lift element' if lift else 'Unlabelled space',
                                    'kind':'lift' if lift else 'unassigned', 'points':rectangle(bounds)})
        if floor_id == 'm1':
            floor['spaces'].append({'id':'m1-hatched','label':'Unmapped area','kind':'void','points':rectangle([85,103,378,918])})
        if prefix == 'm':
            floor['markers'].append({'id':f'{floor_id}-entrance', 'label':'Entrance', 'point':[365,969] if level==7 else ([480,75] if level==1 else [355,93])})
        elif floor_id == 'p1':
            floor['markers'].append({'id':'p1-entrance','label':'Entrance','point':[495,1300]})
        floors.append(floor)

data = {'schemaVersion': 1, 'activeLayoutId': '2026-2027', 'layouts': [{
    'id': '2026-2027', 'name': '2026–2027', 'buildings': [{'id':'p','name':'Primary Building'}, {'id':'m','name':'Main Building'}],
    'floors': floors, 'rooms': converted}]}
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'data/campus.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
(ROOT/'tools/digitization-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'Extracted {len(converted)} rooms on {len(floors)} floors')
print('Non-rectangular overlays:', [(r['room'],r['fill']) for r in report if r['fill']<0.85])
