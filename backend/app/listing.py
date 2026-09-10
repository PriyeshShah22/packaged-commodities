"""Store inventory import: values are supplied declarations, never OCR guesses."""
import csv
import io
import re
import calendar
from datetime import date

from app.ocr.extractor import DATE, DURATION, _normalize_date, _normalize_quantity


ALIASES = {
    'product_name': ['product', 'product name', 'name'],
    'brand_name': ['brand', 'brand name'],
    'category': ['category', 'product category'],
    'net_quantity': ['quantity', 'pack size', 'net quantity', 'net weight'],
    'mrp': ['mrp', 'maximum retail price'],
    'manufacture_pack_import_date': ['mfg date', 'manufacturing date', 'manufacture date', 'packed on', 'packing date', 'pack date'],
    'best_before_or_use_by': ['expiry', 'expiry date', 'best before', 'best before date', 'use by', 'use by date'],
    'responsible_party_name': ['manufacturer', 'manufacturer name', 'packer', 'importer', 'manufacturer packer importer'],
    'responsible_party_address': ['address', 'manufacturer address', 'responsible party address'],
    'commodity_name': ['common name', 'generic name', 'commodity name'],
    'barcode': ['barcode', 'gtin', 'ean'],
    'batch_number': ['batch', 'batch number', 'batch no', 'lot', 'batch lot'],
    'consumer_phone': ['consumer mobile', 'consumer phone', 'consumer care phone', 'customer care phone'],
    'consumer_email': ['consumer email', 'consumer care email', 'customer care email'],
    'consumer_care': ['consumer care', 'customer care'],
    'country_of_origin': ['country of origin', 'origin'],
    'fssai_license': ['fssai', 'fssai number', 'fssai license'],
    'unit_sale_price': ['unit sale price', 'unit price'],
}


def header_key(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


def parse_inventory(content: bytes) -> dict:
    if len(content) > 2 * 1024 * 1024:
        raise ValueError('Inventory file must be smaller than 2 MB.')
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise ValueError('Save the inventory as CSV UTF-8 before uploading.') from exc
    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=',;\t')
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text, newline=''), dialect=dialect, strict=True)
    try:
        headers = next(reader)
    except (StopIteration, csv.Error) as exc:
        raise ValueError('The file is empty or has no valid header row.') from exc
    lookup = {header_key(alias): field for field, aliases in ALIASES.items() for alias in [field, *aliases]}
    mapping = [lookup.get(header_key(h)) for h in headers]
    if 'product_name' not in mapping:
        raise ValueError('A Product Name column is required. Download the blank template for supported columns.')
    known = [field for field in mapping if field]
    if len(known) != len(set(known)):
        raise ValueError('Multiple columns map to the same field. Keep one column per declaration.')
    rows = []
    try:
        for cells in reader:
            if not any(cell.strip() for cell in cells):
                continue
            if len(rows) >= 50:
                raise ValueError('Import at most 50 products per listing batch.')
            if len(cells) != len(headers):
                raise ValueError(f'CSV line {reader.line_num}: expected {len(headers)} columns, received {len(cells)}. Quote values containing commas.')
            raw = dict(zip(headers, cells))
            values = {field: cell.strip() for field, cell in zip(mapping, cells) if field and cell.strip()}
            if not values.get('product_name'):
                raise ValueError(f'CSV line {reader.line_num}: Product Name is empty.')
            if any(len(cell) > 3000 for cell in cells):
                raise ValueError(f'CSV line {reader.line_num}: a cell exceeds 3,000 characters.')
            declarations, evidence, warnings, reviews = {}, {}, [], []
            for field, original in values.items():
                if field in ('product_name', 'category'):
                    continue
                normalized = original
                valid = True
                if field == 'net_quantity':
                    normalized = _normalize_quantity(original)
                    valid = bool(normalized) and bool(re.fullmatch(r'\s*\d+(?:[.,]\d+)?\s*[A-Za-zℓ.]+\s*', original)) and float(re.match(r'\d+(?:[.,]\d+)?', original)[0].replace(',', '.')) > 0
                elif field == 'mrp':
                    match = re.fullmatch(r'\s*(?:(?:MRP|maximum retail price)\s*[:.]?\s*)?(?:₹|Rs\.?|INR)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*/-)?\s*(inclusive of all taxes)?\s*', original, re.I)
                    valid = bool(match) and float(match[1].replace(',', '')) > 0
                    normalized = f'MRP ₹{match[1].replace(",", "")}' + (' inclusive of all taxes' if match[2] else '') if valid else original
                elif field in ('manufacture_pack_import_date', 'best_before_or_use_by'):
                    candidate = original
                    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', candidate):
                        try:
                            candidate = date.fromisoformat(candidate).strftime('%d/%m/%Y')
                        except ValueError:
                            candidate = ''
                    normalized = _normalize_date(candidate) if candidate else ''
                    valid = bool(normalized) and bool(DATE.fullmatch(candidate) or (field == 'best_before_or_use_by' and DURATION.fullmatch(candidate)))
                    if valid and re.fullmatch(r'\d{2}/\d{2}/\d{4}', normalized):
                        try:
                            day, month, year = map(int, normalized.split('/'))
                            date(year, month, day)
                        except ValueError:
                            valid = False
                elif field == 'barcode':
                    valid = bool(re.fullmatch(r'\d{8}|\d{12,14}', original))
                    if valid:
                        digits = list(map(int, original))
                        valid = (10 - sum(n * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(digits[:-1]))) % 10) % 10 == digits[-1]
                elif field == 'fssai_license':
                    valid = bool(re.fullmatch(r'\d{14}', original))
                if not valid:
                    normalized = original
                    warnings.append(f'{field.replace("_", " ")}: verify the imported value “{original}”.')
                declarations[field] = normalized
                evidence[field] = {'field': field, 'value': normalized, 'raw_text': original, 'confidence': .95 if valid else .4, 'source_type': 'inventory_import', 'image_id': f'CSV-ROW-{reader.line_num}'}
                if not valid:
                    reviews.append((field, warnings[-1]))
            if not declarations.get('consumer_care'):
                contact = ' · '.join(declarations.get(f, '') for f in ('consumer_phone', 'consumer_email') if declarations.get(f))
                if contact:
                    declarations['consumer_care'] = contact
                    evidence['consumer_care'] = {'field': 'consumer_care', 'value': contact, 'raw_text': contact, 'confidence': .95, 'source_type': 'inventory_import', 'image_id': f'CSV-ROW-{reader.line_num}'}
            # Inventory date consistency is a review signal, not a legal finding.
            def date_range(field):
                if evidence.get(field, {}).get('confidence', 0) < .75:
                    return None
                parts = declarations[field].split('/')
                if len(parts) == 3 and all(p.isdigit() for p in parts):
                    day, month, year = map(int, parts)
                    return date(year, month, day), date(year, month, day)
                if len(parts) == 2 and all(p.isdigit() for p in parts):
                    month, year = map(int, parts)
                    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])
                return None

            manufactured = date_range('manufacture_pack_import_date')
            expires = date_range('best_before_or_use_by')
            if manufactured and manufactured[0] > date.today():
                reviews.append(('manufacture_pack_import_date', 'The supplied manufacture/pack date is in the future. Verify the inventory entry and package.'))
            if expires and expires[1] < date.today():
                reviews.append(('best_before_or_use_by', 'The supplied best-before/use-by period has passed. Verify the date type, package and applicable requirement; this is not an automatic legal violation.'))
            if manufactured and expires and expires[1] < manufactured[0]:
                reviews.append(('best_before_or_use_by', 'The supplied best-before/use-by date precedes manufacture/packing. Verify both inventory dates.'))
            findings = [{'rule_id': f'INVENTORY-DATA-{index + 1}', 'rule_version': 'inventory-data-v1', 'rule_reference': 'Inventory data quality — officer verification, not a statutory finding', 'requirement': f'Verify supplied {field.replace("_", " ")}', 'outcome': 'REVIEW', 'reason': reason, 'evidence': [evidence[field]]} for index, (field, reason) in enumerate(reviews)]
            warnings.extend(reason for _, reason in reviews if reason not in warnings)
            rows.append({'rowNumber': reader.line_num, 'name': values['product_name'], 'category': values.get('category', 'unknown'), 'declarations': declarations, 'fields': evidence, 'raw': raw, 'warnings': warnings, 'reviewFindings': findings})
    except csv.Error as exc:
        raise ValueError(f'Invalid CSV: {exc}') from exc
    if not rows:
        raise ValueError('The file contains headers but no products. Add real inventory rows before importing.')
    return {'rows': rows, 'ignoredColumns': [h for h, field in zip(headers, mapping) if not field]}
