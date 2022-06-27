import { parse } from 'csv-parse';
import { transform } from 'stream-transform';
import { stringify } from 'csv-stringify';
import fs from 'fs';
import { parseAsync } from 'json2csv'
import moment from 'moment-mini'

export let fileNameArr = []
export let processedData

const parser = async (fileStream, fileName) => {
    console.log(fileName)
    const path = `/csvs/${fileName}.csv`

    let fileTime = fileName.split('_')[2]

    if (!fileName) {
        return "no file uploaded"
    }


    let secondsStart = Number(fileTime.substring(0, 2)) * 3600 + Number(fileTime.substring(2, 4)) * 60 + Number(fileTime.substring(4, 6))

    try {
        console.log("read dir",fs.readdirSync('/csvs'))
        console.log("Does the folder exist?",fs.existsSync('/csvs'))
        if (fs.existsSync("/csvs/"+`${fileName}.csv`)) {
            fileNameArr.push(`${fileName}`)
            console.log(`file ${fileName} already exists, no need to upload`)
            return fileName
        }
    } catch (err) {
        console.error(err)
    }

    if (!fileName.includes('Data.lvm')) {
        console.log(` ${fileName} is not a 10 Hz .lvm file, skipping`)
        return " "
    }

    async function streamFileUpload() {
        await new Promise((resolve) => {
            fileStream.pipe(parse({
                delimiter: '\t',
                from_line: 25,
                columns: [
                    "X_Value", "Latitude", "Latitude-Dir", "Longitude", "Longitude-Dir", "GPS_Quality", "GroundSpeedGPS", "FuelInletTemp", "FuelOutletTemp", "FuelMeterInlet_ccAmount", "FuelMeterInlet_ccRate", "FuelMeterOutlet_ccAmount", "FuelMeterOutlet_ccRate", "EEC1_EngineSpeed", "ETC1_TransInRPM", "ETC1_TransOutRPM", "LFE1_EngineFuelRate", "Altitude", "Comment"
                ],
                relax_column_count: true
            }))
                .pipe(transform(function (data) {
                    /* if (data['Email'] === '(Not disclosed)') return null; */
                    let lat = Number(data['Latitude'].slice(0, 2)) + Number(data['Latitude'].slice(2, 7) / 60);
                    let long = -Number(data['Longitude'].slice(0, 2)) - Number(data['Longitude'].slice(2, 7) / 60);
                    let time = secondsStart + Number(data['X_Value'])
                    // Skip data we don't want

                    // Transform data to a new structure

                    return { Time: time, Latitude: lat, Longitude: long, GroundSpeedGPS: data['GroundSpeedGPS'], FuelInletTemp: data['FuelInletTemp'], FuelOutletTemp: data['FuelOutletTemp'], FuelMeterInlet_ccAmount: data['FuelMeterInlet_ccAmount'], FuelMeterInlet_ccRate: data['FuelMeterInlet_ccRate'], FuelMeterOutlet_ccAmount: data['FuelMeterOutlet_ccAmount'], FuelMeterOutlet_ccRate: data['FuelMeterOutlet_ccRate'] };
                }))
                .pipe(stringify({
                    delimiter: ',',
                    relax_column_count: true,
                    skip_empty_lines: true,
                    header: false,
                    // This names the resulting columns for the output file.
                    // columns: ["Latitude", "Longitude", "GroundSpeedGPS"]
                    columns: ["Time", "Latitude", "Longitude", "GroundSpeedGPS", "FuelInletTemp", "FuelOutletTemp", "FuelMeterInlet_ccAmount", "FuelMeterInlet_ccRate", "FuelMeterOutlet_ccAmount", "FuelMeterOutlet_ccRate"]
                }))
                .pipe(fs.createWriteStream("/csvs/"+`${fileName}.csv`))
                .on('finish', () => {

                    console.log(`Done with csv conversion on ${fileName} 🍻 `);
                    fileNameArr.push(`${fileName}`)
                    resolve()
                });
        })

        return fileName
    }


    return await streamFileUpload().catch(console.error);

};

export const csvfileupload = async ({
    filename,
    stream: fileStream,
}) => {

    return await parser(fileStream, filename);
};


export const filterparse = async (filename, minlong, maxlong, minlat, maxlat) => {

    let finalData = []
    let onSwitch = false

    // if (filename in processedData){
    //     console.log("data already exists, skipping mutate step")
    //     return processedData.filename
    // }

    let thisSegmentFuelUsedInGrams = 0
    let data = {
        avgSpeed: 0,
        count: 0,
        dist: 0,
        startTime: 0,
        coords: [],
        heatMap: {
            "type": "FeatureCollection",
            "features": []
        },
        diesel25C: 0
    }
    let it, ot, ir, or;

    const dataReset = () => {
        thisSegmentFuelUsedInGrams = 0
        data = {
            avgSpeed: 0,
            count: 0,
            dist: 0,
            startTime: 0,
            coords: [],
            heatMap: {
                "type": "FeatureCollection",
                "features": []
            },
            diesel25C: 0
        }

    }

    const stashData = () => {
        data.duration = data.count * 0.1 / 60
        data.avgSpeed = data.dist / data.duration
        data.dist = Number.parseFloat(data.dist * .621371).toFixed(1)
        console.log('Done with consolidation ');
        console.log(`Data.count: ${data.count}`)
        data.truckName = filename.split('_')[0]
        data.eMPG = Number.parseFloat((data.dist) / (data.diesel25C)).toFixed(2)
        data.avgSpeed = Number.parseFloat(data.avgSpeed * 0.621371 * 60).toFixed(1)
        data.duration = Number.parseFloat(data.duration).toFixed(2)
        processedData = { ...processedData, filename: data }
        if(data.dist>40){
            console.log("dist", data.dist)
            console.log("start time", new Date(data.startTime * 1000).toUTCString().substring(17, 22))
            console.log("start date", data.startDate)
            console.log("truck name", data.truckName)
            console.log("empg", data.eMPG)
            console.log("duration", data.duration)
            console.log(" ")
        }
        finalData.push(data)
        dataReset()
        onSwitch = false;
    }

    await new Promise((resolve) => {
        fs.createReadStream("/csvs/"+`${filename}.csv`)
            .pipe(parse({
                delimiter: ',',
                from_line: 1,
                columns: ["Time", "Latitude", "Longitude", "GroundSpeedGPS", "FuelInletTemp", "FuelOutletTemp", "FuelMeterInlet_ccAmount", "FuelMeterInlet_ccRate", "FuelMeterOutlet_ccAmount", "FuelMeterOutlet_ccRate"],

                relax_column_count: true
            }))
            .pipe(transform(function (data) {

                // if ((Number(data["Longitude"])<minlong) || (Number(data["Longitude"])>maxlong)) return null;
                // if ((Number(data["Latitude"])<minlat) || (Number(data["Latitude"])>maxlat)) return null;  
                // Skip data we don't want
                if (data["GroundSpeedGPS"] < 5) return null

                // Transform data to a new structure


                return { Time: data['Time'], Latitude: data["Latitude"], Longitude: data["Longitude"], GroundSpeedGPS: data['GroundSpeedGPS'], FuelInletTemp: data['FuelInletTemp'], FuelOutletTemp: data['FuelOutletTemp'], FuelMeterInlet_ccAmount: data['FuelMeterInlet_ccAmount'], FuelMeterInlet_ccRate: data['FuelMeterInlet_ccRate'], FuelMeterOutlet_ccAmount: data['FuelMeterOutlet_ccAmount'], FuelMeterOutlet_ccRate: data['FuelMeterOutlet_ccRate'] };
            })).on('data', (chunk) => {


                // console.log(chunk)

                if (onSwitch) {
                    if (data.count === 1) {
                        if(Number(chunk['Time'])>86400){
                            data.startDate = Number(filename.split('_')[1])+1
                        } else{
                             data.startDate = Number(filename.split('_')[1])
                        }
                        if(Number(chunk['Time'])>86400){
                            data.startTime = Number(chunk['Time'])-86400
                        } else{
                            data.startTime = Number(chunk['Time'])
                        }
                    }
                    //These are my inlet & outlet Temp and Volume(in cc's) values
                    it = chunk["FuelInletTemp"]
                    ot = chunk["FuelOutletTemp"]
                    ir = chunk["FuelMeterInlet_ccRate"]
                    or = chunk["FuelMeterOutlet_ccRate"]
                    //Calculates mass of fuel used
                    thisSegmentFuelUsedInGrams = ir * 0.1 * (-0.0000024 * Math.pow(it, 2) - 0.00038 * it + 0.838) - or * 0.1 * (-0.0000024 * Math.pow(ot, 2) - 0.00038 * ot + 0.838)
                    //Converts mass of fuel in to equivalent diesel gallons at 25 deg C
                    data.diesel25C += Number.parseFloat(thisSegmentFuelUsedInGrams).toFixed(4) / ((-0.0000024 * Math.pow(25, 2) - 0.00038 * 25 + 0.838) * 7000) * 2.2
                    data.dist += chunk["GroundSpeedGPS"] * 0.1 / 3600
                    data.count += 1
                    if (data.count % 25 === 0) {

                        data.coords.push([chunk["Longitude"], chunk["Latitude"]])
                        data.heatMap["features"].push(
                            {
                                "type": "Feature",
                                "properties": {
                                    "speed": Number(chunk["GroundSpeedGPS"])
                                },
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [chunk["Longitude"], chunk["Latitude"]]
                                }
                            }
                        )

                    }


                    if((Number(chunk["Longitude"]) != 0) && (Number(chunk["Latitude"]) != 0)){
                        
                        if ((Number(chunk["Longitude"]) < minlong) || (Number(chunk["Longitude"]) > maxlong)) {
                            stashData()
                        }
    
                        if ((Number(chunk["Latitude"]) < minlat) || (Number(chunk["Latitude"]) > maxlat)) {
                            stashData()
                        }
                    }

                    
                }
                if (!onSwitch) {
                    if (((Number(chunk["Longitude"]) > minlong) && (Number(chunk["Longitude"]) < maxlong)) && ((Number(chunk["Latitude"]) > minlat) && (Number(chunk["Latitude"]) < maxlat))) {
                        onSwitch = true;
                    }
                }



            })
            .on('finish', () => {

                if (onSwitch) {
                    stashData()
                }
                resolve()
            })
    })
    // const {coords, heatMap,...rest} = data
    return finalData


}

export const writeCSV = async (data) => {
    const fields = ['truckName', 'formattedDate', 'formattedTime', 'dist', 'avgSpeed', 'eMPG', 'diff', 'duration', 'timeDiff'];
    const opts = { fields };

    return parseAsync(data, opts)
        .then(csv => {
            return csv
        })
        .catch(err => console.error(err));

}

export const findPairs = async ({ data, processingDetails }) => {
    let finalCompares = []
    let temp = []
    let contains = false
    let a, b

    await data.map(run1 => {


        data.map(run2 => {
            contains = false
            if (finalCompares?.length > 0) {
                for (let i of finalCompares) {
                    if (i.includes(run1) || i.includes(run2)) {
                        contains = true
                    }
                }
            }


            if ((Math.abs((Number(run1.duration) - Number(run2.duration)) / Number(run1.duration)) < processingDetails.runPercentDiff) && (run1.startDate == run2.startDate) && (Number(run1.dist) > 15 && Number(run2.dist) > 15) && (run1.truckName !== run2.truckName) && (Math.abs(Number(run1.startTime) - Number(run2.startTime)) < (processingDetails.minutesDiffStart * 60)) && !contains) {
                if (run1.truckName === "HY108") {
                    temp = [run1, run2]
                } else {
                    temp = [run2, run1]
                }


                temp[0].diff = Number.parseFloat((temp[0].eMPG - temp[1].eMPG) / temp[0].eMPG * 100).toFixed(2)
                temp[1].diff = Number.parseFloat((temp[1].eMPG - temp[0].eMPG) / temp[1].eMPG * 100).toFixed(2)


                temp[0].timeDiff = Number.parseFloat((temp[0].duration - temp[1].duration) / temp[0].duration * 100).toFixed(2)
                temp[1].timeDiff = Number.parseFloat((temp[1].duration - temp[0].duration) / temp[1].duration * 100).toFixed(2)

                a = moment(temp[0].startDate, "YYYYMMDD");
                temp[0].formattedDate = a.format("MMM Do YYYY");

                b = moment(temp[1].startDate, "YYYYMMDD");
                temp[1].formattedDate = b.format("MMM Do YYYY");

                temp[0].formattedTime = new Date(temp[0].startTime * 1000).toUTCString().substring(17, 22)
                temp[1].formattedTime = new Date(temp[1].startTime * 1000).toUTCString().substring(17, 22)
                
                finalCompares.push(temp)
            }
        })
    })
    processedData = [].concat(...finalCompares)
    let csvData = await writeCSV(processedData)
     fileNameArr = [];
    return { finalCompares, csvData }

}