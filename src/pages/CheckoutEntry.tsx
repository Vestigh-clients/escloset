import { Navigate, useLocation } from "react-router";

const CHECKOUT_CONTACT_PATH = "/checkout/contact";

const CheckoutEntry = () => {
  const location = useLocation();

  return <Navigate replace to={{ pathname: CHECKOUT_CONTACT_PATH, search: location.search, hash: location.hash }} />;
};

export default CheckoutEntry;
