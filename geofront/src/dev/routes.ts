import type { ZoneId } from '../contracts/manifest';

/**
 * The walkable route through each zone, as contract node names: spawn → points of
 * interest → exit trigger. Used by the walk test (T1.4) and the bench flight (T1.5) until
 * authored guided paths exist (T2.1). Names, not coordinates, so it survives art swaps.
 */
export const ZONE_ROUTES: Record<ZoneId, readonly string[]> = {
  'z1-surface': ['POI_phone_booth', 'POI_misato_arrival', 'POI_station_portal', 'POI_cartrain_boarding', 'TRG_shaft_head'],
  'z2-descent': ['POI_pamphlet_handover', 'POI_shaft_midpoint', 'TRG_cartrain_exit'],
  'z3-cavern': ['POI_cavern_reveal', 'POI_viaduct_mid', 'TRG_rail_terminus'],
  'z4-pyramid': ['POI_checkpoint', 'POI_card_reader', 'POI_gate', 'TRG_pyramid_doors'],
  'z5-corridors': [
    'POI_entrance_hall',
    'POI_sign_corridor_a',
    'POI_escalator_1_top',
    'POI_misato_lost',
    'POI_escalator_2_top',
    'POI_lower_landing',
    'POI_ritsuko_meet',
    'POI_lift_lobby',
    'TRG_lift_cage',
  ],
  'z7-cage': ['POI_dock_edge', 'POI_walkway_south', 'POI_walkway_north', 'POI_gantry_01', 'POI_walkway_north', 'POI_walkway_south', 'TRG_lift_command'],
  'z6-command': ['POI_stairs_top', 'POI_stairs_bottom', 'POI_launch_view', 'POI_lower_stairs_top', 'POI_screen_floor'],
};
