
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const COLORS = {
  primary: '#0B6E4F',
  success: '#16A34A',
  dark: '#14201B',
  muted: '#E6ECE7',
  white: '#FFFFFF',
  neutral: '#46564E',
};

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const MapView = ({
  pickup = [75.8577, 26.9124],
  destination = [75.8267, 26.8851],
  height = '550px',
}) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize map only once.
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: pickup,
      zoom: 12,
      attributionControl: true,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.addSource('ride-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      });

      map.addLayer({
        id: 'ride-route-line',
        type: 'line',
        source: 'ride-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': COLORS.primary,
          'line-width': 5,
          'line-opacity': 1,
        },
      });
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add or update pickup and destination markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateMarkers = () => {
      markersRef.current.forEach(marker => marker.remove());

      const createMarker = (color, size = 20) => {
        const el = document.createElement('div');

        Object.assign(el.style, {
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          background: color,
          border: '4px solid white',
          boxShadow: '0 2px 8px rgba(20,32,27,0.25)',
        });

        return el;
      };

      const start = new mapboxgl.Marker({
        element: createMarker(COLORS.success),
      })
        .setLngLat(pickup)
        .addTo(map);

      const end = new mapboxgl.Marker({
        element: createMarker(COLORS.dark),
      })
        .setLngLat(destination)
        .addTo(map);

      markersRef.current = [start, end];
    };

    if (map.loaded()) {
      updateMarkers();
    } else {
      map.once('load', updateMarkers);
    }
  }, [pickup, destination]);

  // Fetch real road-following directions.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const controller = new AbortController();

    const fetchRoute = async () => {
      setLoading(true);
      setError('');
      setRouteInfo(null);

      try {
        const coordinates = `${pickup.join(',')};${destination.join(',')}`;

        const params = new URLSearchParams({
          geometries: 'geojson',
          overview: 'full',
          steps: 'false',
          access_token: mapboxgl.accessToken,
        });

        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Directions request failed (${response.status})`);
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes?.length) {
          throw new Error(data.message || 'No driving route found.');
        }

        if (controller.signal.aborted) return;

        const route = data.routes[0];
        const geometry = route.geometry;

        const updateMap = () => {
          if (controller.signal.aborted) return;

          const source = map.getSource('ride-route');
          if (!source) return;

          source.setData({
            type: 'Feature',
            properties: {},
            geometry,
          });

          const bounds = geometry.coordinates.reduce(
            (bounds, coordinate) => bounds.extend(coordinate),
            new mapboxgl.LngLatBounds(
              geometry.coordinates[0],
              geometry.coordinates[0]
            )
          );

          map.fitBounds(bounds, {
            padding: 80,
            maxZoom: 15,
            duration: 800,
          });

          setRouteInfo({
            distance: (route.distance / 1000).toFixed(1),
            duration: Math.ceil(route.duration / 60),
          });

          setLoading(false);
        };

        if (map.isStyleLoaded() && map.getSource('ride-route')) {
          updateMap();
        } else {
          map.once('load', updateMap);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;

        console.error('Route error:', err);
        setError(err.message || 'Unable to calculate route.');
        setLoading(false);
      }
    };

    fetchRoute();

    return () => controller.abort();
  }, [pickup, destination]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: '14px',
        overflow: 'hidden',
        background: COLORS.muted,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      {/* Route information */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 2,
          background: COLORS.white,
          padding: '12px 16px',
          borderRadius: '10px',
          boxShadow: '0 2px 12px rgba(20,32,27,0.10)',
          fontFamily: 'Inter, sans-serif',
          color: COLORS.dark,
        }}
      >
        {loading ? (
          <span style={{ fontSize: 13 }}>
            Calculating route...
          </span>
        ) : error ? (
          <span style={{ fontSize: 13, color: '#9A2A1A' }}>
            {error}
          </span>
        ) : routeInfo ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {routeInfo.distance} km
            </div>
            <div style={{ fontSize: 12, color: COLORS.neutral }}>
              Approx. {routeInfo.duration} min drive
            </div>
          </>
        ) : (
          <span style={{ fontSize: 13 }}>
            Waiting for map...
          </span>
        )}
      </div>
    </div>
  );
};

export default MapView;
