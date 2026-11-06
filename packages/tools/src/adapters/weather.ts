import { WeatherAdapter, WeatherContext } from "@nova/shared";
import { db } from "../db.js";

export class SqliteWeatherAdapter implements WeatherAdapter {
  constructor(private db: any) {}

  async getContext(location: string, date?: Date): Promise<WeatherContext> {
    const targetDate = date || new Date();
    targetDate.setHours(12, 0, 0, 0);

    const stmt = this.db.prepare(`
      SELECT location, date, temperature_min, temperature_max, temperature_unit, conditions, precipitation, humidity
      FROM weather_forecasts
      WHERE location = ? AND date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(location, targetDate.toISOString().split("T")[0]) as
      | {
          location: string;
          date: string;
          temperature_min: number;
          temperature_max: number;
          temperature_unit: "C" | "F";
          conditions: string;
          precipitation: number;
          humidity: number;
        }
      | undefined;

    if (!row) {
      return this.getDefaultWeather(location, targetDate);
    }

    return {
      location: row.location,
      date: new Date(row.date),
      forecast: {
        temperature: {
          min: row.temperature_min,
          max: row.temperature_max,
          unit: row.temperature_unit,
        },
        conditions: row.conditions,
        precipitation: row.precipitation,
        humidity: row.humidity,
      },
    };
  }

  private getDefaultWeather(location: string, date: Date): WeatherContext {
    return {
      location,
      date,
      forecast: {
        temperature: { min: 18, max: 25, unit: "C" },
        conditions: "Partly cloudy",
        precipitation: 10,
        humidity: 60,
      },
    };
  }
}