// 虚拟数据：在客户正式数据到位前用于开发、演示与验收走查。
// 机构名、医生名、地址、手机号均为程序生成的虚构信息；手机号统一在 139-0000-xxxx 号段。
// 使用固定随机种子，每次生成结果一致，便于对照截图与测试。
import { newId } from './ids.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITIES = [
  { city: '上海', w: 5, districts: ['静安区', '徐汇区', '长宁区', '浦东新区', '黄浦区'], roads: ['南京西路', '淮海中路', '衡山路', '世纪大道', '虹桥路'] },
  { city: '北京', w: 4, districts: ['朝阳区', '海淀区', '东城区'], roads: ['建国路', '三里屯路', '中关村大街', '东长安街'] },
  { city: '广州', w: 3, districts: ['天河区', '越秀区'], roads: ['天河路', '体育东路', '环市东路'] },
  { city: '深圳', w: 3, districts: ['南山区', '福田区'], roads: ['深南大道', '科技园路', '福华三路'] },
  { city: '杭州', w: 2, districts: ['西湖区', '上城区'], roads: ['教工路', '延安路', '庆春路'] },
  { city: '成都', w: 2, districts: ['锦江区', '武侯区'], roads: ['红星路三段', '人民南路', '春熙路'] },
  { city: '重庆', w: 1, districts: ['渝中区', '江北区'], roads: ['解放碑步行街', '观音桥步行街'] },
  { city: '南京', w: 1, districts: ['鼓楼区', '玄武区'], roads: ['中山路', '北京东路'] },
  { city: '武汉', w: 1, districts: ['江汉区', '武昌区'], roads: ['解放大道', '中南路'] },
  { city: '西安', w: 1, districts: ['雁塔区', '碑林区'], roads: ['小寨东路', '南大街'] },
  { city: '苏州', w: 1, districts: ['姑苏区', '工业园区'], roads: ['人民路', '星海街'] },
  { city: '长沙', w: 1, districts: ['芙蓉区', '岳麓区'], roads: ['五一大道', '麓山南路'] },
];
const BRANDS = ['华瑅', '源真', '凝美', '昀熙', '黛颜', '瑞妍', '澜庭', '悦植', '初颂', '璞玥', '沐澄', '芮禾', '知岚', '熙研', '映川', '素雅', '承光', '若水', '霁和', '安黎', '韶华', '清屿', '曦颜', '宁致'];
const SUFFIX = ['医疗美容门诊部', '医疗美容诊所', '医疗美容医院', '医疗美容门诊部'];
const SURNAMES = '王李张刘陈杨黄赵周吴徐孙朱马胡郭林何高罗郑梁谢宋唐许韩冯邓曹彭曾萧田董潘袁蔡蒋余于杜叶程魏苏吕丁沈任姚卢傅钟姜崔谭陆范汪廖石金韦贾夏付方邹熊白孟秦邱侯江尹薛闫段雷龙黎史陶贺顾毛郝龚邵万覃武钱严莫孔向常汤';
const GIVEN = '薇晏懿砚涵舟姝云清宁静婧瑶琳璇婉欣怡悦岚萱妍蕾雅晴然冉宇哲睿航泽辰逸轩铭昊杰皓霖嘉禾一诺若曦子墨景行思远知微书瑶语桐';

export function generateFakeData({ seed = 20261014, now = new Date() } = {}) {
  const r = rng(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const int = (min, max) => min + Math.floor(r() * (max - min + 1));

  const weighted = CITIES.flatMap((c) => Array(c.w).fill(c));
  const brands = [...BRANDS];
  const orgs = [];
  for (let i = 0; i < 26; i++) {
    const c = i < CITIES.length ? CITIES[i] : pick(weighted); // 每个城市至少一家
    const brand = brands.splice(Math.floor(r() * brands.length), 1)[0];
    const district = pick(c.districts);
    const p = r();
    orgs.push({
      id: newId(),
      code: `JVL-O${String(i + 1).padStart(4, '0')}`,
      name: `${c.city}${brand}${pick(SUFFIX)}`,
      city: c.city,
      address: `${c.city}市${district}${pick(c.roads)}${int(1, 1999)}号${r() < 0.5 ? `${int(2, 28)}层` : ''}`,
      // 约 55% 两品类均授权，30% 仅 JUVELOOK，15% 仅 Volume
      auth_blue: p < 0.85 ? 1 : 0,
      auth_black: p < 0.55 || p >= 0.85 ? 1 : 0,
      status: i === 25 ? 'revoked' : 'active', // 一家已撤销授权的机构，用于验证前台不展示
    });
  }

  const usedNames = new Set();
  const doctors = [];
  for (const o of orgs) {
    const n = int(2, 6);
    for (let k = 0; k < n; k++) {
      let name;
      do {
        name = pick([...SURNAMES]) + (r() < 0.45 ? pick([...GIVEN]) : pick([...GIVEN]) + pick([...GIVEN]));
      } while (usedNames.has(name));
      usedNames.add(name);
      const i = doctors.length + 1;
      doctors.push({
        id: newId(),
        code: `JVL-D${String(i).padStart(4, '0')}`,
        name,
        org_id: o.id,
        mobile: `1390000${String(i).padStart(4, '0')}`,
        // 初始支数（模拟客户提供的历史数据），未授权品类为 0
        blue_count: o.auth_blue ? int(0, 380) : 0,
        black_count: o.auth_black ? int(0, 260) : 0,
        status: i === 7 || i === 41 ? 'revoked' : 'active',
        _org: o,
      });
    }
  }

  // 近 60 天的扫码核销记录，同时累加到医生支数上
  const scans = [];
  const usedCodes = new Set();
  const pad = (x) => String(x).padStart(2, '0');
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const active = doctors.filter((d) => d.status === 'active' && d._org.status === 'active');
  for (let s = 0; s < 640; s++) {
    const d = active[Math.floor(Math.pow(r(), 1.6) * active.length)]; // 少数医生用量更大
    const kinds = [d._org.auth_blue && 'blue', d._org.auth_black && 'black'].filter(Boolean);
    const kind = pick(kinds);
    let code;
    do {
      code = '8617388' + String(int(0, 999999)).padStart(6, '0') + String(int(0, 9999999)).padStart(7, '0');
    } while (usedCodes.has(code));
    usedCodes.add(code);
    const daysAgo = Math.floor(Math.pow(r(), 1.3) * 60);
    const t = new Date(now.getTime() - daysAgo * 86400_000);
    t.setHours(int(9, 20), int(0, 59), int(0, 59));
    if (t > now) t.setTime(now.getTime() - int(60, 3600) * 1000);
    scans.push({
      id: newId(),
      code,
      doctor_id: d.id,
      org_id: d.org_id,
      kind,
      product_name: kind === 'blue' ? 'JUVELOOK' : 'JUVELOOK Volume',
      batch_number: `JV${pick(['2603', '2604', '2605', '2606'])}${String(int(1, 40)).padStart(2, '0')}`,
      position_flag: r() < 0.02 ? '1' : '0',
      created_at: fmt(t),
    });
    d[kind === 'blue' ? 'blue_count' : 'black_count']++;
  }
  scans.sort((a, b) => a.created_at.localeCompare(b.created_at));

  return { orgs, doctors: doctors.map(({ _org, ...d }) => d), scans };
}
