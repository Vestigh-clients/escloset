
-- Create enums
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'prefer_not_to_say');
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'partially_refunded');
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_amount');

-- =====================
-- CUSTOMERS
-- =====================
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  avatar_url TEXT,
  date_of_birth DATE,
  gender public.gender_type,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0.00,
  last_order_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_customers_email ON public.customers (email);
CREATE INDEX idx_customers_phone ON public.customers (phone);
CREATE INDEX idx_customers_created_at ON public.customers (created_at);

-- =====================
-- ADDRESSES
-- =====================
CREATE TABLE public.addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label VARCHAR(50),
  recipient_name VARCHAR(200) NOT NULL,
  recipient_phone VARCHAR(20),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  landmark VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
  postal_code VARCHAR(20),
  delivery_instructions TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_addresses_customer_id ON public.addresses (customer_id);

-- =====================
-- CATEGORIES
-- =====================
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- =====================
-- PRODUCTS
-- =====================
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  sku VARCHAR(100) UNIQUE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  benefits JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  weight_grams INTEGER,
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_products_category_id ON public.products (category_id);
CREATE INDEX idx_products_slug ON public.products (slug);
CREATE INDEX idx_products_is_available ON public.products (is_available);
CREATE INDEX idx_products_is_featured ON public.products (is_featured);

-- =====================
-- ORDERS
-- =====================
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  shipping_address_id UUID REFERENCES public.addresses(id) ON DELETE RESTRICT,
  shipping_address_snapshot JSONB NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(100),
  payment_reference VARCHAR(255),
  subtotal NUMERIC(10,2) NOT NULL,
  shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  notes TEXT,
  admin_notes TEXT,
  ip_address VARCHAR(45),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX idx_orders_order_number ON public.orders (order_number);
CREATE INDEX idx_orders_status ON public.orders (status);
CREATE INDEX idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX idx_orders_created_at ON public.orders (created_at);

-- =====================
-- ORDER ITEMS
-- =====================
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_image_url TEXT,
  unit_price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items (product_id);

-- =====================
-- ORDER STATUS HISTORY
-- =====================
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status public.order_status,
  new_status public.order_status NOT NULL,
  changed_by VARCHAR(100),
  note TEXT,
  notified_customer BOOLEAN DEFAULT false,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history (order_id);

-- =====================
-- SHIPPING RATES
-- =====================
CREATE TABLE public.shipping_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  states JSONB DEFAULT '[]'::jsonb,
  base_rate NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- =====================
-- DISCOUNT CODES
-- =====================
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  type public.discount_type NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  minimum_order_amount NUMERIC(10,2) DEFAULT 0,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  customer_id UUID REFERENCES public.customers(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_discount_codes_code ON public.discount_codes (code);

-- =====================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipping_rates_updated_at BEFORE UPDATE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- ORDER NUMBER AUTO-GENERATION
-- =====================
CREATE SEQUENCE public.order_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'LUX-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- =====================
-- RLS — Public read for categories, products, shipping_rates
-- =====================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are publicly readable" ON public.categories FOR SELECT USING (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT USING (true);

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shipping rates are publicly readable" ON public.shipping_rates FOR SELECT USING (true);

-- RLS for customers, addresses, orders, order_items, order_status_history, discount_codes
-- These need service_role or edge functions to write; public read is restricted
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Discount codes: public can read active codes
CREATE POLICY "Active discount codes are publicly readable" ON public.discount_codes FOR SELECT USING (is_active = true);

-- Orders and related: allow insert via anon for guest checkout (edge function will handle validation)
CREATE POLICY "Allow anonymous order creation" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous address creation" ON public.addresses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous order insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous order items insert" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous order status history insert" ON public.order_status_history FOR INSERT WITH CHECK (true);

-- Allow reading orders by order_number (for confirmation page)
CREATE POLICY "Orders readable by order number" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Order items readable" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Order status history readable" ON public.order_status_history FOR SELECT USING (true);
