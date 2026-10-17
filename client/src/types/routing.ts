/**
 * The modes WakaWay routes over. Ride-hailing is not one of them: the app
 * exists for the rider who cannot or will not call a car.
 */
export type TransportMode =
  | 'walk'
  | 'keke'      // Tricycle (Keke Napep / Marwa)
  | 'okada'     // Motorcycle — only where legal, only when asked for
  | 'danfo'     // Yellow minibus, and the LAMATA standard routes
  | 'brt'       // Bus Rapid Transit (Primero / LAMATA)
  | 'rail';     // Blue / Red Line
