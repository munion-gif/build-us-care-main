const baseUrl = process.env.AUDIT_BASE_URL?.trim() || "http://127.0.0.1:3001";

const detailChecks = [
  {
    category: "toilet",
    path: "/products/toilet/toilet_replace%3Atwo-piece%3A01%3Abc-401"
  },
  {
    category: "washbasin",
    path: "/products/washbasin/basin_replace%3Ahalf-pedestal%3A31%3Ac151500l"
  },
  {
    category: "faucet",
    path: "/products/faucet/faucet_replace%3Abasin-faucet%3A01%3Abfl-610"
  },
  {
    category: "bidet",
    path: "/products/bidet/bidet_install%3Abidet%3A01%3Adst-1100"
  },
  {
    category: "ventilation",
    path: "/products/ventilation/ventilator_replace%3Aventilator%3A01%3Ajv-201"
  },
  {
    category: "window-handle",
    path: "/products/window-handle/sash_handle%3Asash-handle%3A01%3A003"
  },
  {
    category: "door-handle",
    path: "/products/door-handle/door_handle%3Adoor-handle%3A01%3Aggsss"
  },
  {
    category: "silicone",
    path: "/products/silicone/silicone_repair%3Asilicone%3A01"
  },
  {
    category: "bath-accessory",
    path: "/products/bath-accessory/bath_accessory%3Abath-accessory%3A01%3Adl-a9018"
  }
];

async function run() {
  const failures = [];
  for (const check of detailChecks) {
    const response = await fetch(`${baseUrl}${check.path}`, { redirect: "manual" });
    const html = await response.text();
    const statusOk = response.status === 200;
    console.log([response.status, check.category, check.path].join("\t"));
    if (!statusOk) {
      failures.push({
        category: check.category,
        path: check.path,
        status: response.status
      });
    }
  }

  if (failures.length > 0) {
    console.error("DETAIL_AUDIT_FAILURES");
    for (const failure of failures) console.error(JSON.stringify(failure));
    process.exit(1);
  }

  console.log(`DETAIL_AUDIT_OK\t${detailChecks.length}`);
}

await run();
