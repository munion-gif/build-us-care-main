type Sheet = {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeSheetName(name: string) {
  return name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
}

function cellType(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return "Number";
  if (typeof value === "boolean") return "Boolean";
  return "String";
}

function cellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function rowXml(values: unknown[], styleId?: string) {
  const cells = values
    .map((value) => {
      const type = cellType(value);
      return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="${type}">${escapeXml(cellValue(value))}</Data></Cell>`;
    })
    .join("");
  return `<Row>${cells}</Row>`;
}

function worksheetXml(sheet: Sheet) {
  const widths = sheet.columns
    .map((column) => {
      const maxLength = Math.max(
        column.length,
        ...sheet.rows.slice(0, 200).map((row) => cellValue(row[column]).length)
      );
      const width = Math.min(Math.max(maxLength * 7, 72), 240);
      return `<Column ss:Width="${width}"/>`;
    })
    .join("");

  const rows = [
    rowXml(sheet.columns, "Header"),
    ...sheet.rows.map((row) => rowXml(sheet.columns.map((column) => row[column])))
  ].join("");

  return `<Worksheet ss:Name="${escapeXml(normalizeSheetName(sheet.name))}"><Table>${widths}${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
}

export function workbookXml(sheets: Sheet[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
    <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="Header">
    <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
    <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
    <Interior ss:Color="#16735F" ss:Pattern="Solid"/>
  </Style>
</Styles>
${sheets.map(worksheetXml).join("")}
</Workbook>`;
}
