// 测试夹具：小而固定的数据集，断言基于这些值。
import { newId } from '../src/db.js';

const ORGS = [
  { key: 'o1', name: '华瑅医疗美容门诊部', city: '上海', address: '上海市静安区南京西路1788号', blue: 1, black: 1 },
  { key: 'o2', name: '朝阳源真医疗美容诊所', city: '北京', address: '北京市朝阳区建国路88号', blue: 1, black: 1 },
  { key: 'o3', name: '西湖凝美医疗美容', city: '杭州', address: '杭州市西湖区教工路18号', blue: 1, black: 0 },
  { key: 'o4', name: '昀熙医疗美容门诊部', city: '成都', address: '成都市锦江区红星路三段1号', blue: 0, black: 1 },
  { key: 'o5', name: '天河黛颜医疗美容诊所', city: '广州', address: '广州市天河区天河路208号', blue: 1, black: 1 },
];

const DOCTORS = [
  { name: '林薇', org: 'o1', blue: 428, black: 216 },
  { name: '顾清晏', org: 'o1', blue: 203, black: 88 },
  { name: '陈嘉懿', org: 'o2', blue: 612, black: 305 },
  { name: '沈砚清', org: 'o2', blue: 174, black: 129 },
  { name: '张若涵', org: 'o3', blue: 96, black: 0 },
  { name: '王砚舟', org: 'o4', blue: 0, black: 274 },
  { name: '周静姝', org: 'o5', blue: 158, black: 340 },
  { name: '苏牧云', org: 'o5', blue: 52, black: 47 },
];

// 仅在库为空时写入，返回写入的机构 / 医生 ID 映射
export function seedDemo(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM orgs').get().n > 0) return null;
  const insOrg = db.prepare(
    'INSERT INTO orgs (id, code, name, city, address, auth_blue, auth_black) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insDoc = db.prepare(
    'INSERT INTO doctors (id, code, name, org_id, blue_count, black_count) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const orgIds = {};
  const doctorIds = {};
  db.exec('BEGIN');
  try {
    ORGS.forEach((o, i) => {
      orgIds[o.key] = newId();
      insOrg.run(orgIds[o.key], `JVL-O${String(i + 1).padStart(4, '0')}`, o.name, o.city, o.address, o.blue, o.black);
    });
    DOCTORS.forEach((d, i) => {
      doctorIds[d.name] = newId();
      insDoc.run(doctorIds[d.name], `JVL-D${String(i + 1).padStart(4, '0')}`, d.name, orgIds[d.org], d.blue, d.black);
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { orgIds, doctorIds };
}
