# Network Inventory Manager

Web application for tracking network device inventory and End-of-Sale (EOS) lifecycle.

Monthly inventory exports (Excel) are imported into a database, cleaned and compared month to month,
so the team can see which devices are past EOS, what has been replaced, and where data quality issues are.

## Planned features
- Excel import with validation and data cleaning ([import format](docs/import-format.md))
- Device search and filtering (hostname, serial, IP, location, model)
- EOS status per device and EOS dashboard
- Month-to-month change tracking (replaced / new / removed devices)
- Data quality checks (duplicate serials, inconsistent EOS dates)
- Replacement cost estimation per model, region and entity
- AI assistant for natural-language questions (Azure OpenAI)

## Tech stack
- **Backend:** Python, FastAPI, SQLAlchemy, pandas
- **Frontend:** React, TypeScript (planned)
- **Database:** SQLite (local), Azure SQL (cloud)
- **Hosting:** Azure App Service, Azure Static Web Apps

## Test data
The `test-data/` folder contains **synthetic data only**. All hostnames, IP addresses,
serial numbers, locations and prices are fictional.