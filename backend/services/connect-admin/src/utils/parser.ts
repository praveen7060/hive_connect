export const parseEnergy = (v: string) => {
const [voltage, current, power, unit] = v.split('/').map(Number)
return { voltage, current, power, unit }
}


export const parseClimate = (v: string) => {
const [temperature, humidity, sunlight] = v.split('/').map(Number)
return { temperature, humidity, sunlight }
}