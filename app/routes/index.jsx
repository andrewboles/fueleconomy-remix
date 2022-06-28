import { Form, useActionData, useTransition, Link, useLoaderData } from "@remix-run/react";
import mapboxgl from "mapbox-gl";
import React, { useEffect, useState } from "react";
import { unstable_parseMultipartFormData, redirect, json } from "@remix-run/node";
import {
  csvfileupload,
  filterparse,
  fileNameArr,
  findPairs,
} from "../utils/csvfileprocess.server";
import { Spinner } from "../components/Spinner";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DrawRectangle from "mapbox-gl-draw-rectangle-mode";
import download from 'downloadjs';
import { getSession } from '../utils/session.server'
import { Icon } from '@iconify/react';

export async function loader({ request }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  return { session }
}

let map1, map2, draw;

const createMaps = ({ setHeldGeos, defaultRoute }) => {
  mapboxgl.accessToken =
    "pk.eyJ1IjoiYW5kcmV3bGIzIiwiYSI6ImNsMXc5ZzFxcDAycmczam1yc3dvaXU3MWIifQ.a4c0rnxuam5PUfbZYMv9jg";
  map1 = new mapboxgl.Map({
    container: "map1",
    style: "mapbox://styles/mapbox/streets-v11",
    center: [-97.79941, 30.50163],
    zoom: 12,
  });

  map2 = new mapboxgl.Map({
    container: "map2",
    style: "mapbox://styles/mapbox/streets-v11",
    center: [-97.79941, 30.50163],
    zoom: 12,
  });

  const marker1 = new mapboxgl.Marker({
    color: "#01b401",
  })
    .setLngLat([-97.800361, 30.502059])
    .addTo(map1);

  const marker2 = new mapboxgl.Marker({
    color: "#01b401",
  })
    .setLngLat([-97.800361, 30.502059])
    .addTo(map2);

  const modes = MapboxDraw.modes;
  modes.draw_rectangle = DrawRectangle;

  draw = new MapboxDraw({
    modes: modes,
  });

  map1.addControl(draw, "top-left");
  draw.changeMode("draw_rectangle");

  map1.on("draw.create", function (feature) {
    let fetchedCoords = feature.features[0].geometry.coordinates[0];
    let longs = [];
    let lats = [];
    fetchedCoords.forEach((coord) => {
      longs.push(coord[0]);
      lats.push(coord[1]);
    });

    setHeldGeos((current) => ({
      ...current,
      minlong: Math.min(...longs),
      maxlong: Math.max(...longs),
      minlat: Math.min(...lats),
      maxlat: Math.max(...lats),
    }));
  });
};

const updateMap = (map, data, geos) => {
  if (map.getLayer("speed")) {
    map.removeLayer("speed");
  }
  if (map.getSource("speed")) {
    map.removeSource("speed");
  }
  let centerCoord = {};
  centerCoord.long = (geos.minlong + geos.maxlong) / 2;
  centerCoord.lat = (geos.minlat + geos.maxlat) / 2;
  map.flyTo({
    center: [centerCoord.long, centerCoord.lat],
    zoom: 7.9,
  });

  map.addSource("speed", {
    type: "geojson",
    data: data.heatMap,
  });

  map.addLayer(
    {
      id: "speed",
      type: "circle",
      source: "speed",
      minzoom: 7,
      paint: {
        // Size circle radius by earthquake magnitude and zoom level
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          ["interpolate", ["linear"], ["get", "speed"], 1, 1, 6, 4],
          16,
          ["interpolate", ["linear"], ["get", "speed"], 1, 5, 6, 50],
        ],
        // Color circle by earthquake magnitude
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "speed"],
          0,
          "blue",
          32,
          "green",
          65,
          "yellow",
          90,
          "orange",
          115,
          "red",
        ],
      },
    },
    "waterway-label"
  );
};

export async function action({ request }) {
  // }
  const forminfo = await unstable_parseMultipartFormData(
    request,
    csvfileupload
  );
  const fileUpload = forminfo.get('upload')
  if (fileUpload === "no file uploaded") {
    return null
  }


  const minlong = forminfo.get("minlong");
  const maxlong = forminfo.get("maxlong");
  const minlat = forminfo.get("minlat");
  const maxlat = forminfo.get("maxlat");
  const minutesDiffStart = forminfo.get('minutesDiffStart')
  const runPercentDiff = forminfo.get('runPercentDiff')

  const processingDetails = { minutesDiffStart, runPercentDiff }

  let data = await Promise.all(
    fileNameArr.map(async (filename) => {
      return await filterparse(filename, minlong, maxlong, minlat, maxlat);
    })
  );
  console.log("files to parse:", data)
  return await findPairs({ data: [].concat(...data), processingDetails });
}

export default function Index() {
  const [heldGeos, setHeldGeos] = useState({
    minlong: -89.52549657858486,
    maxlong: -88.30086962453233,
    minlat: 34.77650859785767,
    maxlat: 35.28734732969582,
  });

  const geos = {
    heldGeos,
    setHeldGeos,
  };

  const [defaultRoute, setDefaultRoute] = useState("DEMO ROUTE")
  const data = useActionData();

  const transition = useTransition();

  const { session } = useLoaderData()

  useEffect(() => {
    if (session?.data?.user && !map1) {
      console.log("creating map")

      createMaps({ heldGeos, setHeldGeos, defaultRoute });
    }

  }, [session?.data?.user]);

  useEffect(() => {
    if (data && data?.finalCompares?.length !== 0) {
      updateMap(map1, data?.finalCompares[0][0], geos.heldGeos);
      updateMap(map2, data?.finalCompares[0][1], geos.heldGeos);
    }
  }, [data, geos.heldGeos]);

  useEffect(() => {
    if (session?.data?.user) {
      console.log("Adding delete coords")
      map1.on("draw.delete", function (e) {
        draw.changeMode("draw_rectangle");

        switch (defaultRoute) {
          case 'DEMO ROUTE':
            setHeldGeos({
              minlong: -89.52549657858486,
              maxlong: -88.30086962453233,
              minlat: 34.77650859785767,
              maxlat: 35.28734732969582,
            });
            break
          case 'C3':
            setHeldGeos({
              minlong: -80.8180873439911,
              maxlong: -80.11159604788541,
              minlat: 39.93143003312096,
              maxlat: 40.23098927819575,
            });
            break

        }



      });
    }

  }, [defaultRoute, session?.data?.user])

  let submitting = transition.state === "submitting";
  let [chosen, setChosen] = useState(0);

  return (
    <>
      {session.data.user ? <div className="main-container">
        <div className="map-container">
          <div id="map1" className="map"></div>
          <div id="map2" className="map"></div>
        </div>

        <div className="second-section">
          {data && data?.finalCompares?.length === 0 && (
            <>
              <h2 className="no-match">
                No Matches Found in Data <Link to="/">Try Again</Link>
              </h2>
            </>
          )}
          {(data && (typeof data !== 'string')) ? (
            <>
              {data?.finalCompares?.length !== 0 && <Nav />}
              {data?.finalCompares.map((run, i) => {
                return (
                  <ResultsCard
                    geos={heldGeos}
                    key={i}
                    data={run}
                    active={i === chosen}
                    onClick={() => setChosen(i)}
                  />
                );
              })}
            </>
          ) : submitting ? (
            <Spinner />
          ) : (
            <>

              <FEForm heldGeos={heldGeos} setHeldGeos={setHeldGeos} defaultRoute={defaultRoute} setDefaultRoute={setDefaultRoute} data={data} />
              <Form method="post" action="/auth/logout">
                <button type="submit">Logout</button>
              </Form>
            </>
          )}
        </div>
      </div > :
        <div className="login-block">
          <img src="green.png" />
          <h2>Fuel Economy Comparison App</h2>
          <Form className="signinform" action="/auth/microsoft" method="post">
            <button>Login with  <Icon icon="logos:microsoft" inline={true} /> to verify OAuth2 Functionality</button>
          </Form>
          <Form className="signinform" action="/auth/dummy" method="post">
            <button>Look around with dummy account / access</button>
          </Form>
        </div>}
    </>
  );
}


const Nav = () => {
  const data = useActionData()
  return (
    <nav className="nav-bar">
      <ul>
        <li>
          <Link to="/">Start Over</Link>
        </li>
        <li>
          <div className="csv-button"
            onClick={async () => {
              // download(data.csvData, `${new Date()}.csv`);
              download('/csvs/HY108_20220510_075136.606_10hzData.lvm.csv');
            }}
          >
            Download CSV
          </div>
        </li>
        <li>
          <Form method="post" action="/auth/logout">
            <button type="submit">Logout</button>
          </Form>
        </li>
      </ul>
    </nav>
  );
};

const Selector = ({ defaultRoute, setDefaultRoute, setHeldGeos }) => {

  const handleChange = async e => {

    await setDefaultRoute(e.target.value)
    switch (e.target.value) {
      case 'DEMO ROUTE':
        setHeldGeos({
          minlong: -89.52549657858486,
          maxlong: -88.30086962453233,
          minlat: 34.77650859785767,
          maxlat: 35.28734732969582,
        });
        break
      case 'C3':
        setHeldGeos({
          minlong: -80.8180873439911,
          maxlong: -80.11159604788541,
          minlat: 39.93143003312096,
          maxlat: 40.23098927819575,
        });
        break

    }
  }

  return (
    <>
      <label htmlFor="defaultRoute">Choose a Default Route:</label>
      <select name="defaultRoute" onChange={async e => handleChange(e)} value={defaultRoute} id="defaultRoute">
        <option value="DEMO ROUTE">Demo Route - Memphis-ish</option>
        <option value="C3">C3 - St. Clairsville to Waynesburg</option>
      </select>
    </>

  )
}

const FEForm = ({ heldGeos, setHeldGeos, defaultRoute, setDefaultRoute, data }) => {

  const [processingDetails, setProcessingDetails] = useState({
    runPercentDiff: 0.03,
    minutesDiffStart: 30,
  })

  return (
    <Form className="fe-form" method="post" encType="multipart/form-data">
      <h2 className="instructions">
        Click on the map to construct a geofence, or select a default route below
      </h2>
      <Selector setDefaultRoute={setDefaultRoute} setHeldGeos={setHeldGeos} defaultRoute={defaultRoute} />
      <label htmlFor="minlong">
        What is the minimum East/West Longitude
      </label>

      <input
        value={heldGeos.minlong}
        onChange={(e) =>
          setHeldGeos((current) => ({ ...current, minlong: e.target.value }))
        }
        type="number"
        id="minlong"
        name="minlong"
      />
      <label htmlFor="maxlong">
        What is the maximum East/West Longitude
      </label>
      <input
        value={heldGeos.maxlong}
        onChange={(e) =>
          setHeldGeos((current) => ({ ...current, maxlong: e.target.value }))
        }
        type="number"
        id="maxlong"
        name="maxlong"
      />
      <label htmlFor="minlat">
        What is the minimum North/South Latitude
      </label>
      <input
        value={heldGeos.minlat}
        onChange={(e) =>
          setHeldGeos((current) => ({ ...current, minlat: e.target.value }))
        }
        type="number"
        id="minlat"
        name="minlat"
      />
      <label htmlFor="maxlat">
        What is the maximum North/South Latitude
      </label>
      <input
        value={heldGeos.maxlat}
        onChange={(e) =>
          setHeldGeos((current) => ({ ...current, maxlat: e.target.value }))
        }
        type="number"
        id="maxlat"
        name="maxlat"
      />
      <label htmlFor="runPercentDiff">
        What Run Duration Differential Between Trucks Do You Want?{<br />}  (0.03 or 3% recommended)
      </label>
      <input
        value={processingDetails.runPercentDiff}
        defaultValue={processingDetails.runPercentDiff}
        onChange={(e) =>
          setProcessingDetails((current) => ({ ...current, runPercentDiff: e.target.value }))
        }
        type="number"
        id="runPercentDiff"
        name="runPercentDiff"
      />
      <label htmlFor="minutesDiffStart">
        What Start Time Differential Between Trucks Do You Want in Minutes?{<br />} (30 minutes recommended)
      </label>
      <input
        value={processingDetails.minutesDiffStart}
        defaultValue={processingDetails.minutesDiffStart}
        onChange={(e) =>
          setProcessingDetails((current) => ({ ...current, minutesDiffStart: e.target.value }))
        }
        type="number"
        id="minutesDiffStart"
        name="minutesDiffStart"
      />
      <input type="file" name="upload" id="upload" multiple />

      <button type="submit">Submit</button>
      {data?.error?.formError && (
        <>
          <h2 className="no-match">
            {data?.error?.formError}
          </h2>
        </>
      )}
    </Form>

  );
};

const ResultsCard = ({ data, active, onClick, geos }) => {
  return (
    <div
      className={active ? "results-card active" : "results-card"}
      onClick={() => {
        updateMap(map1, data[1], geos);
        updateMap(map2, data[0], geos);
        onClick();
      }}
    >
      <table>
        <tr>
          <th>Truck</th>
          <th>Date</th>
          <th>Start Time</th>
          <th>Miles Driven</th>
          <th>Avg Speed [mph]</th>
          <th>eMPG</th>
          <th>eMPG Diff %</th>
          <th>Run Duration [min]</th>
          <th>Run Duration Diff %</th>
        </tr>
        <tr>
          <td>{data[1].truckName}</td>
          <td>{data[1].formattedDate}</td>
          <td>{data[1].formattedTime}</td>
          <td>{data[1].dist}</td>
          <td>{data[1].avgSpeed}</td>
          <td>{data[1].eMPG}</td>
          <td>{data[1].diff}</td>
          <td>{data[1].duration}</td>
          <td>{data[1].timeDiff}</td>
        </tr>
        <tr>
          <td>{data[0].truckName}</td>
          <td>{data[0].formattedDate}</td>
          <td>{data[0].formattedTime}</td>
          <td>{data[0].dist}</td>
          <td>{data[0].avgSpeed}</td>
          <td>{data[0].eMPG}</td>
          <td className="emphasis">{data[0].diff}</td>
          <td>{data[0].duration}</td>
          <td>{data[0].timeDiff}</td>
        </tr>
      </table>
    </div>
  );
};
