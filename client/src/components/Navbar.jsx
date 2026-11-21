import React from 'react'
import Logo from "../assets/cityride-logo-kit/cityride-logo-kit/svg/lockup-horizontal-primary.svg";


const Navbar = () => {
  return (
    <nav className='h-[8vh] w-full bg-surface border-b border-neutral-border flex items-center justify-between px-4' >
        <img src={Logo} alt="CityRide lockup-horizontal-primary Logo" className='h-8' />
        <ul className='flex items-center gap-4 font-inter text-xs font-semibold ' >
          <li>Find a bus</li>
          <li>About Demo Data</li>
        </ul>
    </nav>
  )
}

export default Navbar
