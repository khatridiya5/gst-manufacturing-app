-- =============================================
-- GST MANUFACTURING APP - DATABASE SCHEMA
-- =============================================

-- Group 1: Foundation

CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15) UNIQUE NOT NULL,
    pan VARCHAR(10),
    address TEXT,
    state VARCHAR(50) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'accountant', 'ca')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Group 2: Master Data

CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    item_type VARCHAR(20) CHECK (item_type IN ('raw_material', 'finished_good', 'scrap')),
    hsn_code VARCHAR(8) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL,
    opening_stock DECIMAL(10,3) DEFAULT 0,
    current_stock DECIMAL(10,3) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    address TEXT,
    state VARCHAR(50),
    state_code VARCHAR(2),
    phone VARCHAR(15),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    address TEXT,
    state VARCHAR(50),
    state_code VARCHAR(2),
    phone VARCHAR(15),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Group 3: Purchase

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    vendor_id INTEGER REFERENCES vendors(id),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    po_date DATE NOT NULL,
    expected_delivery DATE,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'received', 'cancelled')),
    total_amount DECIMAL(12,2),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    vendor_id INTEGER REFERENCES vendors(id),
    po_id INTEGER REFERENCES purchase_orders(id),
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(12,2) NOT NULL,
    cgst_amount DECIMAL(10,2) DEFAULT 0,
    sgst_amount DECIMAL(10,2) DEFAULT 0,
    igst_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    itc_eligible BOOLEAN DEFAULT TRUE,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_line_items (
    id SERIAL PRIMARY KEY,
    purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
    item_id INTEGER REFERENCES items(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(10,2) DEFAULT 0,
    sgst DECIMAL(10,2) DEFAULT 0,
    igst DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL
);

-- Group 4: Production

CREATE TABLE bom_headers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    finished_good_id INTEGER REFERENCES items(id),
    version VARCHAR(10) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bom_line_items (
    id SERIAL PRIMARY KEY,
    bom_id INTEGER REFERENCES bom_headers(id),
    raw_material_id INTEGER REFERENCES items(id),
    quantity_required DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    scrap_percentage DECIMAL(5,2) DEFAULT 0
);

CREATE TABLE production_orders (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    bom_id INTEGER REFERENCES bom_headers(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    planned_quantity DECIMAL(10,3) NOT NULL,
    actual_quantity DECIMAL(10,3),
    scrap_quantity DECIMAL(10,3) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    production_cost DECIMAL(12,2),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_ledger (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    item_id INTEGER REFERENCES items(id),
    transaction_type VARCHAR(30) NOT NULL,
    -- purchase_in, production_consumption, production_output, sales_out, scrap
    reference_id INTEGER,
    reference_type VARCHAR(30),
    quantity DECIMAL(10,3) NOT NULL,
    -- positive = stock in, negative = stock out
    unit_cost DECIMAL(10,2),
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Group 5: Sales

CREATE TABLE sales_invoices (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    customer_id INTEGER REFERENCES customers(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    place_of_supply VARCHAR(2) NOT NULL,
    -- state code of customer
    is_interstate BOOLEAN NOT NULL,
    -- TRUE = IGST, FALSE = CGST+SGST
    subtotal DECIMAL(12,2) NOT NULL,
    cgst_amount DECIMAL(10,2) DEFAULT 0,
    sgst_amount DECIMAL(10,2) DEFAULT 0,
    igst_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'partial')),
    eway_bill_required BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sales_line_items (
    id SERIAL PRIMARY KEY,
    sales_invoice_id INTEGER REFERENCES sales_invoices(id),
    item_id INTEGER REFERENCES items(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_rate DECIMAL(5,2) NOT NULL,
    cgst DECIMAL(10,2) DEFAULT 0,
    sgst DECIMAL(10,2) DEFAULT 0,
    igst DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL
);

-- Group 6: GST

CREATE TABLE gst_returns (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    return_type VARCHAR(10) NOT NULL CHECK (return_type IN ('GSTR1', 'GSTR3B')),
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'filed')),
    data JSONB,
    filed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Group 7: Accounting

CREATE TABLE ledger_accounts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(30) NOT NULL,
    -- asset, liability, equity, income, expense
    code VARCHAR(20) UNIQUE,
    is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    entry_date DATE NOT NULL,
    description TEXT,
    reference_type VARCHAR(30),
    reference_id INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE journal_line_items (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    ledger_account_id INTEGER REFERENCES ledger_accounts(id),
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0
);

CREATE TABLE workers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    name VARCHAR(100) NOT NULL,
    worker_code VARCHAR(20) UNIQUE NOT NULL,
    department VARCHAR(50),
    phone VARCHAR(15),
    qr_code_data TEXT,
    -- stores the unique string encoded in their QR
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE part_instances (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    production_order_id INTEGER REFERENCES production_orders(id),
    item_id INTEGER REFERENCES items(id),
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    qr_code_data TEXT,
    -- unique string encoded in part QR
    current_status VARCHAR(30) DEFAULT 'not_started',
    -- not_started, in_progress, completed, rejected
    current_worker_id INTEGER REFERENCES workers(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wip_scans (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    worker_id INTEGER REFERENCES workers(id),
    part_instance_id INTEGER REFERENCES part_instances(id),
    scan_type VARCHAR(20) NOT NULL,
    -- start, finish, reject
    scanned_at TIMESTAMP DEFAULT NOW(),
    duration_minutes INTEGER,
    -- auto calculated when finish scan happens
    workstation VARCHAR(50),
    notes TEXT
);