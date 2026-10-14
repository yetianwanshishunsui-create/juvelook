import { tx } from './db.js';
import { generateFakeData } from './fake-data.js';

// 仅在库为空时写入
export function seedFakeData(db, opts) {
  if (db.prepare('SELECT COUNT(*) AS n FROM orgs').get().n > 0) return null;
  const data = generateFakeData(opts);
  const insOrg = db.prepare(
    `INSERT INTO orgs (id, code, name, city, address, auth_blue, auth_black, status)
     VALUES (:id, :code, :name, :city, :address, :auth_blue, :auth_black, :status)`,
  );
  const insDoc = db.prepare(
    `INSERT INTO doctors (id, code, name, org_id, mobile, blue_count, black_count, status)
     VALUES (:id, :code, :name, :org_id, :mobile, :blue_count, :black_count, :status)`,
  );
  const insScan = db.prepare(
    `INSERT INTO scans (id, code, doctor_id, org_id, kind, product_name, batch_number, position_flag, verify_raw, created_at)
     VALUES (:id, :code, :doctor_id, :org_id, :kind, :product_name, :batch_number, :position_flag, NULL, :created_at)`,
  );
  tx(db, () => {
    data.orgs.forEach((o) => insOrg.run(o));
    data.doctors.forEach((d) => insDoc.run(d));
    data.scans.forEach((s) => insScan.run(s));
  });
  return data;
}
