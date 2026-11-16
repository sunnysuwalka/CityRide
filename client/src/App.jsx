
import React, { useEffect, useState } from "react";
import axios from "axios";

import lockuphorizontalprimary from "./assets/cityride-logo-kit/cityride-logo-kit/svg/lockup-horizontal-primary.svg";
import BackgroundImage from "./assets/images/Modern Blue Electric Bus Boulevard.png";

import JourneyCard from "./components/JourneyCard";
import EmptyJourneys from "./components/EmptyJourneys";

import { FaLeaf, FaArrowRightArrowLeft } from "react-icons/fa6";
import SearchingJourneys from "./components/SearchingJourneys";

const API_BASE = import.meta.env.VITE_BASE_URL || "http://localhost:5001/api/v1";

const App = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [Boarding, setBoarding] = useState("");
  const [Destination, setDestination] = useState("");

  const [journeyDate, setJourneyDate] = useState(() => {
    const today = new Date();

    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");
  });

  const [Time, setTime] = useState("");

  const [Stops, setStops] = useState([])
  const [AvailableTrips, setAvailableTrips] = useState(null)

  const [openBoardingSuggestions, setOpenBoardingSuggestions] = useState(false)
  const [openDestinationSuggestions, setopenDestinationSuggestions] = useState(false)

  useEffect(() => {

    const loadStops = async () => {
      try {
        const response = await axios.get(`${API_BASE}/stops`)

        console.log(response)

        if (!response.status === 200) {
          throw new Error;
        };

        const data = await response.data.stops;
        if (!data) {
          setError("Something Went Wrong on our side, Please Refreash the Page")
          return;
        }
        setStops(data)

        console.log(Stops)

      } catch (Error) {
        console.error("Error Fetching Stop Data: ", Error)
        return;
      }
    }

    loadStops()

  }, [])



  // Swap pickup and destination
  const SwapValues = () => {
    setBoarding(Destination);
    setDestination(Boarding);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (num) => String(num).padStart(2, "0");

    return hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  };



  const SearchJourney = async () => {
    if (!Boarding.trim() || !Destination.trim()) {
      setError("Please enter both pickup and destination.");
      return;
    }

    if (Boarding === Destination) {
      setError("Boarding and Destination Stops Cannot be the same")
      setNotice("Retry")
      return;
    }

    const BoardingCode = Stops.find(item=> item.stop_name === Boarding)?.stop_id
    const DestinationCode = Stops.find(item=> item.stop_name === Destination)?.stop_id

    setError("")
    setNotice("")
    setAvailableTrips(null)

    setIsLoading(true);

    try {
      const response = await axios.get(
        `${API_BASE}/journeys/search`,
        {
          params: {
            fromStopId: BoardingCode,
            toStopId: DestinationCode,
            date: journeyDate,
            after: Time || undefined
          }
        }
      );

      console.log("Journey Results:", response.data);

      if(!Array.isArray(response.data.data.journeys)){
        setError("Something went wrong on our end. Please try again in a moment.");
        return;
      }

      const data = await response.data.data.journeys

      setAvailableTrips(data)


    } catch (err) {
      console.error("Journey search failed:", err);
      setError(
        err.response?.data?.message ||
        "Unable to fetch journeys. Please try again."
      )

    } finally {
      setIsLoading(false);
    }
  };

  const filterStops = (stops,searchValue)=>{
    const search = searchValue?.trim().toLowerCase();

    return stops.filter(item=>item.stop_name?.toLowerCase().includes(search))
    .sort((a,b)=>{
      const aStarts = a.stop_name?.toLowerCase().startsWith(search);
      const bStarts = b.stop_name?.toLowerCase().startsWith(search);

      return Number(bStarts) - Number(aStarts);
    });
  }

  const filteredBoardingStops = filterStops(Stops,Boarding);
  const filteredDestinationStops = filterStops(Stops, Destination)

  

  return (
    <main className="h-screen">

      <section className="h-screen w-full mx-auto border-[1px] border-black/25 grid grid-cols-2">

        {/* LEFT SECTION */}

        <div className="h-screen relative overflow-hidden">

          {/* Background Image */}

          <img
            className="absolute inset-0 z-0 h-full w-full object-cover"
            src={BackgroundImage}
            alt=""
          />

          {/* White Gradient */}

          <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_100%_100%_at_0%_50%,white_0%,white_15%,rgba(255,255,255,0.85)_30%,transparent_65%)] -rotate-45 -translate-x-24 translate-y-24" />

          {/* Logo */}

          <img
            src={lockuphorizontalprimary}
            className="relative z-20 h-14 m-3"
            alt="Logo"
          />

          {/* Heading */}

          <p className="relative z-20 m-3 mt-6 font-bold leading-none text-[2.5rem] font-sora w-[50%] text-white/70 [text-shadow:0_2px_3px_rgba(0,0,0,0.5)]">
            Find Your Bus and Route
          </p>

          {/* Bottom Information */}

          <div className="absolute z-20 bottom-0 w-full flex items-center leading-none justify-between h-[10%]">

            <p className="w-[35%] p-3 text-[0.9rem] font-inter opacity-95 leading-tight text-primary">
              Explore Routes, Check Timings, Plan Your Journey
            </p>

            <div className="flex items-center opacity-80">

              <div className="p-2 rounded-full bg-primary">
                <FaLeaf color="white" />
              </div>

              <div className="font-sora text-white font-extralight bg-primary rounded-r-md pl-1 pr-2 py-1 -translate-x-1 text-[0.9rem]">
                Clean Travel
              </div>

            </div>
          </div>

        </div>


        {/* RIGHT SECTION */}

        <div className="h-screen grid grid-rows-[auto_1fr]" >

          <div className="h-fit p-3 w-full border relative overflow-y-visible">

            <h1 className="font-sora text-[2.5rem] font-semibold text-primary">
              Where to Go?
            </h1>


            {/* BOARDING AND DESTINATION */}

            <div className="mt-2 flex gap-4">

              {/* Boarding */}

              <div className="relative flex items-center w-[65%] gap-1 bg-surface h-fit py-3 px-3 rounded-lg border border-primary">

                <label
                  htmlFor="Boarding"
                  className="font-inter font-extralight text-[0.8rem] leading-none border-r border-gray-500 pr-2"
                >
                  From
                </label>

                <input
                  id="Boarding"
                  type="text"
                  name="Boarding"
                  value={Boarding}
                  onChange={(e) => {
                    setBoarding(e.target.value);
                    if (e.target.value) {
                      setOpenBoardingSuggestions(true);
                    } else {
                      setOpenBoardingSuggestions(false);
                    }
                  }}
                  className="min-w-0 w-full appearance-none border-0 outline-none h-full px-2 bg-transparent rounded-md font-inter text-sm placeholder:text-black placeholder:font-extralight"
                  placeholder="Select Pickup"
                />

                {openBoardingSuggestions &&

                  <div className="absolute z-50 top-12 left-0 min-h-fit max-h-[30vh] bg-surface-light border shadow-sm rounded-md p-3 overflow-y-scroll" >
                    {filteredBoardingStops.map((item, key) => (
                      <button onClick={() => { setBoarding(item.stop_name), setOpenBoardingSuggestions(false) }} className="py-1 px-2 my-1 bg-surface-light w-full text-left block border border-neutral-border" key={key} >{item.stop_name}</button>
                    ))}
                  </div>

                }



              </div>


              {/* Swap Button */}

              <button
                type="button"
                onClick={SwapValues}
                className="bg-transparent rounded-md p-1 text-primary flex items-center"
                aria-label="Swap boarding and destination"
              >
                <FaArrowRightArrowLeft className="text-xl" />
              </button>


              {/* Destination */}

              <div className="relative flex items-center w-[65%] gap-1 bg-surface h-fit py-3 px-3 rounded-lg border border-primary">

                <label
                  htmlFor="Destination"
                  className="font-inter font-extralight text-[0.8rem] leading-none border-r border-gray-500 pr-2"
                >
                  To
                </label>

                <input
                  id="Destination"
                  type="text"
                  name="Destination"
                  value={Destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (e.target.value) {
                      setopenDestinationSuggestions(true)
                    }
                    else {
                      setopenDestinationSuggestions(false)
                    }
                  }}
                  className="min-w-0 w-full appearance-none border-0 outline-none h-full px-2 bg-transparent rounded-md font-inter text-sm placeholder:text-black placeholder:font-extralight"
                  placeholder="Search Destination"
                />

                {openDestinationSuggestions &&

                  <div className="absolute z-50 top-12 left-0 min-h-fit max-h-[30vh] bg-surface-light border shadow-sm rounded-md p-3 overflow-y-scroll" >
                    {filteredDestinationStops.map((item, key) => (
                      <button onClick={() => { setDestination(item.stop_name), setopenDestinationSuggestions(false) }} className="py-1 px-2 my-1 bg-surface-light w-full text-left block border border-neutral-border" key={key} >{item.stop_name}</button>
                    ))}
                  </div>

                }

              </div>

            </div>


            {/* DATE AND TIME */}

            <div className="mt-4 flex gap-4">

              {/* Date */}

              <div className="relative flex items-center w-[65%] gap-1 bg-surface h-fit py-3 px-3 rounded-lg border border-primary">

                <label
                  htmlFor="journeyDate"
                  className="font-inter font-extralight text-[0.8rem] leading-none border-r border-gray-500 pr-2"
                >
                  Date
                </label>

                <input
                  id="journeyDate"
                  type="date"
                  name="journeyDate"
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  className="min-w-0 w-full appearance-none outline-none border-0 px-2 bg-transparent rounded-md font-inter text-sm"
                />

              </div>


              {/* Time */}

              <div className="relative flex items-center w-[65%] gap-1 bg-surface h-fit py-3 px-3 rounded-lg border border-primary">

                <label
                  htmlFor="Time"
                  className="font-inter font-extralight text-[0.8rem] leading-none border-r border-gray-500 pr-2"
                >
                  Time
                </label>

                <input
                  id="Time"
                  type="time"
                  name="Time"
                  value={Time}
                  onChange={(e) => setTime(e.target.value)}
                  className="min-w-0 w-full appearance-none outline-none border-0 px-2 bg-transparent rounded-md font-inter text-sm"
                />

              </div>

            </div>

            {error && (
              <div className="text-alert-error text-sm font-inter mt-3">
                {error}
              </div>
            )}

            {/* SEARCH BUTTON */}

            <button
              disabled={isLoading}
              onClick={SearchJourney}
              className="w-full bg-transparent border border-primary text-primary font-semibold rounded-md mt-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>

          </div>

          <div className="h-full overflow-y-scroll px-6 pt-2" >
            {AvailableTrips && AvailableTrips?.length > 0 ? (
              AvailableTrips.map((item, index) => (
                <JourneyCard
                  key={item.tripId || index}
                  headsign={item.tripHeadsign}
                  tripId={item.tripId}
                  from={item.departure?.stopName}
                  to={item.arrival?.stopName}
                  departureTime={item.departure?.time}
                  arrivalTime={item.arrival?.time}
                  duration={formatDuration(item.durationSeconds)}
                  className="my-2"
                />
              ))
            ) : isLoading ? <SearchingJourneys /> : AvailableTrips?.length === 0 ? <EmptyJourneys variant="noResults"/> : <EmptyJourneys variant="idle"/>
          }
          </div>

        </div>

      </section>

    </main>
  );
};

export default App;
