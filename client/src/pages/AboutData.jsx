import React from 'react'

const AboutData = () => {

    const topics = [
        {heading: "What is synthetic", text: "Routes, stops, schedules and fares. They may be inspired by Bhilwara but are not official."},
        {heading: "What times mean", text: "All times are scheduled. CityRide V1 does not know where any bus is right now."},
        {heading: "One direction only", text: "Each demo route runs one way, so searching in reverse can have no result."},
        {heading: "Dataset", text: "Version 1.0.0-demo · 15 routes · 22 stops · valid 26 Oct 2026 – 31 Oct 2027 · published by CityRide Bhilwara Demo Project"},
    ]

  return (
    <main className='py-6 px-4 w-[40vw]' >
      <div className='font-semibold text-[2.5rem] font-inter text-black px-3' >
        About the demo data
      </div>
      <p className='font-inter text-sm text-neutral-light px-3 mt-3' >CityRide V1 is a prototype. Everything you see is invented for learning and demonstration</p>
      <div className='pl-5 pt-4' >
        {topics.map((item,key)=>(
            <div className='p-3 my-3 bg-surface-white border border-neutral-border rounded-lg' >
                <div className='font-semibold text-black' >{item.heading}</div>
                <p className='mt-1 font-inter text-neutral-light text-xs' >{item.text}</p>
            </div>
        ))}
      </div>
    </main>
  )
}

export default AboutData
