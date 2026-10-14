// 前台公开查询。只返回 status = 'active' 的医生和机构。
const MAX_RESULTS = 50;

// LIKE 模糊匹配时转义用户输入里的通配符
const likeArg = (q) => `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;

const productsOf = (o) => [o.auth_blue ? 'blue' : null, o.auth_black ? 'black' : null].filter(Boolean);

// 机构未授权的品类，支数返回 null（前台显示「未授权」）
const countsOf = (d, products) => ({
  blue: products.includes('blue') ? d.blue_count : null,
  black: products.includes('black') ? d.black_count : null,
});

export function createQueries(db) {
  const stmt = {
    doctorCount: db.prepare(
      `SELECT COUNT(*) AS n FROM doctors d JOIN orgs o ON o.id = d.org_id
       WHERE d.status = 'active' AND o.status = 'active'`,
    ),
    orgCount: db.prepare(`SELECT COUNT(*) AS n FROM orgs WHERE status = 'active'`),
    // 城市筛选只列出有认证医生的城市
    cities: db.prepare(
      `SELECT o.city, COUNT(*) AS n FROM doctors d JOIN orgs o ON o.id = d.org_id
       WHERE d.status = 'active' AND o.status = 'active' AND o.city <> ''
       GROUP BY o.city ORDER BY n DESC, o.city`,
    ),
    searchDoctors: db.prepare(
      `SELECT d.*, o.name AS org_name, o.city, o.auth_blue, o.auth_black
       FROM doctors d JOIN orgs o ON o.id = d.org_id
       WHERE d.status = 'active' AND o.status = 'active'
         AND (:q IS NULL OR d.name LIKE :q ESCAPE '\\' OR d.code = :code)
         AND (:city IS NULL OR o.city = :city)
       ORDER BY d.name LIMIT ${MAX_RESULTS + 1}`,
    ),
    doctor: db.prepare(
      `SELECT d.*, o.name AS org_name, o.city, o.address, o.auth_blue, o.auth_black
       FROM doctors d JOIN orgs o ON o.id = d.org_id
       WHERE d.id = ? AND d.status = 'active' AND o.status = 'active'`,
    ),
    searchOrgs: db.prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM doctors d WHERE d.org_id = o.id AND d.status = 'active') AS doctor_count
       FROM orgs o
       WHERE o.status = 'active' AND (o.name LIKE :q ESCAPE '\\' OR o.code = :code)
       ORDER BY o.name LIMIT ${MAX_RESULTS + 1}`,
    ),
    org: db.prepare(`SELECT * FROM orgs WHERE id = ? AND status = 'active'`),
    orgDoctors: db.prepare(
      `SELECT * FROM doctors WHERE org_id = ? AND status = 'active' ORDER BY name`,
    ),
  };

  // 返回 MAX_RESULTS 条，多查一条用来判断是否被截断
  const page = (rows) => ({ items: rows.slice(0, MAX_RESULTS), truncated: rows.length > MAX_RESULTS });

  return {
    meta() {
      return {
        doctorCount: stmt.doctorCount.get().n,
        orgCount: stmt.orgCount.get().n,
        cities: stmt.cities.all().map((r) => r.city),
      };
    },

    searchDoctors({ q, city }) {
      const rows = stmt.searchDoctors.all({ q: q ? likeArg(q) : null, code: q || null, city: city || null });
      const { items, truncated } = page(rows);
      return {
        truncated,
        items: items.map((d) => {
          const products = productsOf(d);
          return {
            id: d.id,
            code: d.code,
            name: d.name,
            city: d.city,
            org: { id: d.org_id, name: d.org_name },
            counts: countsOf(d, products),
          };
        }),
      };
    },

    doctor(id) {
      const d = stmt.doctor.get(id);
      if (!d) return null;
      const products = productsOf(d);
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        city: d.city,
        org: { id: d.org_id, name: d.org_name, city: d.city, address: d.address, products },
        counts: countsOf(d, products),
      };
    },

    searchOrgs({ q }) {
      const { items, truncated } = page(stmt.searchOrgs.all({ q: likeArg(q), code: q }));
      return {
        truncated,
        items: items.map((o) => ({
          id: o.id,
          code: o.code,
          name: o.name,
          city: o.city,
          address: o.address,
          products: productsOf(o),
          doctorCount: o.doctor_count,
        })),
      };
    },

    org(id) {
      const o = stmt.org.get(id);
      if (!o) return null;
      const products = productsOf(o);
      const doctors = stmt.orgDoctors.all(id).map((d) => ({
        id: d.id,
        name: d.name,
        counts: countsOf(d, products),
      }));
      const sum = (k) => (products.includes(k) ? doctors.reduce((s, d) => s + d.counts[k], 0) : null);
      return {
        id: o.id,
        code: o.code,
        name: o.name,
        city: o.city,
        address: o.address,
        products,
        totals: { blue: sum('blue'), black: sum('black') },
        doctors,
      };
    },
  };
}
