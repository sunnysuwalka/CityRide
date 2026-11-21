
import React, { useEffect, useState } from "react";
import { Routes,Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import BusFinder from "./pages/BusFinder";
import AboutData from "./pages/AboutData";


const App = () => {
  return (
    <main className="bg-surface h-screen">
        <Navbar/>
        <div className="py-1 px-4 bg-alert-noticeLight text-alert-notice text-xs font-inter" >
         <span className="font-semibold" >Demo data.</span> Routes, times and fares are synthetic, not official city transit information.
        </div>
  
      <Routes>
        <Route path="/" element={<BusFinder/>} />
        <Route path="/about-data" element={<AboutData/>} />
      </Routes>

    </main>
  );
};

export default App;
