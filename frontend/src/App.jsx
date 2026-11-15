
import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";

import Navbar from "./Components/Navbar";
import { PrivateRoute } from "./Components/PrivateRoute";

import { checkAuth } from "./Store/User/User";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Templates } from "./pages/Templates";
import { About } from "./pages/About";
import { Contact } from "./pages/Contact";
import { CreateInvoice } from "./pages/CreateInvoice";
import MyInvoices from "./pages/MyInvoices";

export const App = () => {
  const location = useLocation();
  const dispatch = useDispatch();

  // Check existing login session when application starts
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  const hideNavbar = ["/login", "/signup"].includes(
    location.pathname
  );

  return (
    <>
      {!hideNavbar && <Navbar />}

      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        {/* PRIVATE ROUTES */}
        <Route element={<PrivateRoute />}>
          <Route path="/templates" element={<Templates />} />

          <Route
            path="/create-invoice"
            element={<CreateInvoice />}
          />

          <Route
            path="/my-invoices"
            element={<MyInvoices />}
          />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
};
