# Inventory Import Format

This document defines which Excel columns the application imports from the monthly network inventory file.

The importer is **name-based**: column order, sheet name and extra columns do not matter.
Only the columns listed below are read; everything else is ignored.

## General rules

| Rule | Behaviour |
|---|---|
| File type | `.xlsx` |
| Sheet | The **first sheet** is read; its name does not matter |
| Header row | Column names must be in **row 1** |
| Column matching | Case-insensitive, leading/trailing spaces ignored (`serialnumber ` = `SerialNumber`) |
| Column order | Does not matter |
| Extra columns | Ignored (not an error) |
| Duplicate header names | Only the first occurrence is used |
| Reporting month | Selected in the upload form; pre-filled from the file name when possible |

## Required columns

The import fails if any of these columns is missing from the file.

| Column | Type | Used for |
|---|---|---|
| `SerialNumber` | text | **Primary device key**; month-to-month comparison |
| `Caption` | text | Hostname; replacement detection (new serial under the same hostname) |
| `IP_Address` | text | Search by IP |
| `Vendor` | text | Filtering, statistics |
| `Model` | text | Link to the model catalog (EOS, replacement, cost) |
| `DeviceType` | text | Filtering; values are normalised (`ROUTER` / `Router` → `Router`) |
| `EOS Date` | date or text | EOS status (see value rules below) |
| `New Location Code` | text | **Location key** |
| `Location Name Final` | text | Location display name |
| `Region` | text | Filtering, dashboard |
| `LocationCategorization` | text | Location priority (Platinum / Gold / Silver / Bronze / …) |

## Optional columns

Imported when present; missing columns are not an error.

| Column | Type | Used for |
|---|---|---|
| `End of Contract Date` | date or text | Contract status; EOS × contract risk matrix |
| `Contract #` | text | Support contract number |
| `Covered` | `1` / `0` / `Virtual` | Whether the device is covered by a support contract |
| `Firm entity code` | text | Cost allocation per legal entity |
| `DeviceOwner` | text | Device ownership category (e.g. load balancers) |
| `Network ID` | text | Secondary location identifier |
| `Meraki Network` | text | Meraki network name |
| `Meraki Organisation` | text | Meraki organisation name |
| `Owner` | text | Managing party (e.g. MSP) |

## Ignored columns (examples)

`IP_Add2`, `Location_CodeU`, `Service Tag`, `Location name`, `Location Name old`, `Product Id`,
`End of Support`, `Contract Expiry`, `Match`, and any other column not listed above.

## Row-level rules

| Situation | Result |
|---|---|
| Empty `SerialNumber` | Row **rejected**, listed in the import report |
| Empty `IP_Address` | Row imported with a **warning** |
| Same `SerialNumber` appears twice in one file | Both rows kept, flagged as **duplicate serial** (data quality) |
| Same `Caption` with different serials | Treated as a **stack** (normal) |

## Value rules

### `EOS Date`
| Value in file | Interpreted as |
|---|---|
| A valid date | That date |
| `No LDOS declared` (any capitalisation) | No EOS date announced |
| Empty cell | No EOS date announced |
| `00:00:00` (Excel zero date) | No EOS date announced |

### `End of Contract Date`
| Value in file | Interpreted as |
|---|---|
| A valid date | Contract end date → status *Active* / *Expired* |
| Text (e.g. `TBC`, `Expired`, `Not in Contract`, `Expired/Renewal Pending by …`) | Stored as contract status text, no date |
| Empty cell or `00:00:00` | No contract data |

## Import report

After every import the application shows:

- number of rows read, imported, rejected and imported with warnings,
- missing required columns (if the import failed),
- list of rejected rows with the reason,
- data quality findings (duplicate serials, models with inconsistent EOS dates).
