import fs from 'node:fs/promises';
import { Workbook } from '@oai/artifact-tool';

// Small factual extract from the official catalogue pages cited per row.
// No batch-specific declarations are inferred from brand or catalogue identity.
const ghee='https://shop.amul.com/en/browse/ghee';
const chocolate='https://shop.amul.com/browse/chocolates';
const bakery='https://old.amul.com/products/amul-cookies.php';
const products=[
 ['Amul Gir Cow Ghee','Amul','Ghee','500 mL','700',ghee],
 ['Amul High Aroma Cow Ghee','Amul','Ghee','1 L','765',ghee],
 ['Amul Cow Ghee','Amul','Ghee','1 L','705',ghee],
 ['Amul Pure Ghee','Amul','Ghee','1 L','660',ghee],
 ['Amul Buffalo Ghee Tin','Amul','Ghee','1 L','680',ghee],
 ['Amul Brown Ghee','Amul','Ghee','500 mL','380',ghee],
 ['Sagar Ghee','Sagar','Ghee','1 L','650',ghee],
 ['Amul Chocominis','Amul','Chocolate','250 g','130',chocolate],
 ['Amul Almondo Chocolate Coated Almonds','Amul','Chocolate','200 g','210',chocolate],
 ['Amul Chocolate Syrup','Amul','Chocolate syrup','650 g','140',chocolate],
 ['Amul Dark Passion Wafer Chocolate Tub','Amul','Wafer chocolate','300 g','200',chocolate],
 ['Amul Mango Lassi','Amul','Lassi','1 L','180','https://shop.amul.com/en/product/amul-mango-lassi-1-l'],
 ['Amul Butter Cookies - Butter','Amul','Cookies','200 g','',bakery],
 ['Amul Butter Cookies - Coconut','Amul','Cookies','50 g','',bakery],
 ['Amul Butter Cookies - Oats and Honey','Amul','Cookies','50 g','',bakery],
 ['Amul Butter Cookies - Nuts and Raisins','Amul','Cookies','50 g','',bakery],
 ['Amul Butter Cookies - Jeera','Amul','Cookies','50 g','',bakery],
 ['Amul Butter Cookies - Cashew','Amul','Cookies','50 g','',bakery],
 ['Amul Digestive Cookies','Amul','Cookies','200 g','',bakery],
 ['Amul Short Bread Cookies','Amul','Cookies','100 g','',bakery],
];
const headers=['Product Name','Brand','Category','Net Quantity','MRP','Mfg Date','Best Before','Manufacturer','Address','Common Name','Barcode','Batch Number','Consumer Phone','Consumer Email','Country of Origin','FSSAI','Unit Sale Price','Source URL','Evidence Notes'];
const rows=products.map(([name,brand,category,qty,mrp,url])=>[name,brand,category,qty,mrp,...Array(12).fill(''),url,'Official catalogue reference only; not verified store stock. MRP where provided is the published online MRP, subject to change. Missing batch dates, GTIN and package declarations must be supplied from the actual package. No open-data licence asserted.']);
if(rows.length!==20||new Set(rows.map(r=>r[0])).size!==20||rows.some(r=>r.length!==headers.length)) throw new Error('Invalid inventory shape');
const workbook=Workbook.create();
const sheet=workbook.worksheets.add('Product Listing');
sheet.getRange('A1:S21').values=[headers,...rows];
workbook.recalculate();
console.log((await workbook.inspect({kind:'region',sheetId:sheet.name,range:'A1:E5',maxChars:1500,tableMaxCols:5,tableMaxRows:5})).ndjson);
// CSV is the application's supported upload format. Serialize the verified
// worksheet values with RFC4180 quoting and UTF-8 BOM for Windows/Excel.
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv='\uFEFF'+sheet.getRange('A1:S21').values.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
await fs.writeFile(new URL('./PackMetrix-20-real-products.csv',import.meta.url),csv,'utf8');
console.log('Created 20 unique genuine catalogue rows; 20 pack sizes; 12 published MRPs.');
