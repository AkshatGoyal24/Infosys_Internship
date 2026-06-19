import pandas as pd
xls = pd.ExcelFile("Mock-Up Data - Infosys Interns 2026.xlsx")
print(xls.sheet_names)
for name in xls.sheet_names:
    print("=== Sheet:", name, "===")
    df = pd.read_excel(xls, name)
    print("shape", df.shape)
    print(df.head(5).to_string())
    print(df.columns.tolist())
    print()
