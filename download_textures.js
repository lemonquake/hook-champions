import fs from 'fs';
import path from 'path';
import https from 'https';

const outDir = path.join(process.cwd(), 'public', 'textures');

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

const polyhavenIds = {
    walls: ['blue_metal_plate', 'brick_4', 'concrete_wall_003'],
    objs: ['metal_grate_rusty', 'rusty_metal_02', 'stone_wall_04']
};

async function fetchFromPolyhaven(type, ids) {
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        console.log(`Fetching info for ${id}...`);
        const res = await fetch(`https://api.polyhaven.com/files/${id}`);
        const data = await res.json();
        
        // Find any diffuse/albedo URL from textures
        let url = null;
        try {
            // Usually data.textures['1k'] or ['2k']
            const resData = data.textures['1k'] || data.textures['2k'] || data.textures['4k'] || Object.values(data.textures)[0];
            if (resData.jpg && resData.jpg.url) url = resData.jpg.url;
            else if (resData.png && resData.png.url) url = resData.png.url;
            else if (resData.mtlx && resData.mtlx.include) {
                const keys = Object.keys(resData.mtlx.include);
                const diffKey = keys.find(k => k.includes('diff') || k.includes('albedo'));
                if (diffKey) url = resData.mtlx.include[diffKey].url;
            }
        } catch (e) {
            console.error('Error parsing: ' + e);
        }

        if (url) {
            const destName = type === 'walls' ? `wall_poly_${i+1}.jpg` : `obj_${i+1}.jpg`;
            await download(url, path.join(outDir, destName));
            console.log(`Downloaded ${id} to ${destName}`);
        } else {
            console.log(`Failed to find URL for ${id}`);
        }
    }
}

async function run() {
    await fetchFromPolyhaven('walls', polyhavenIds.walls);
    await fetchFromPolyhaven('objs', polyhavenIds.objs);
}
run();
