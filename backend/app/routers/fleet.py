"""ForecastFlow AI — Fleet Management Router"""

import random
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import FleetVehicle, User

router = APIRouter(prefix="/fleet", tags=["fleet"])

# Seed coordinates for major logistics hubs
REGION_COORDS = {
    "North": (43.65, -79.38),
    "South": (25.77, -80.19),
    "East": (40.71, -74.00),
    "West": (34.05, -118.24),
    "Central": (41.88, -87.63),
    "North Hub": (45.42, -75.69),
    "South Hub": (29.76, -95.37),
    "East Metro": (42.36, -71.06),
    "West Coast": (37.77, -122.42),
    "Midwest": (39.10, -94.58),
}


def _seed_fleet(db: Session) -> None:
    if db.query(FleetVehicle).count() > 0:
        return
    vehicles = []
    regions = list(REGION_COORDS.keys())
    types = ["truck", "truck", "truck", "van", "van"]
    statuses = ["active", "active", "active", "en_route", "idle", "maintenance"]

    for i in range(1, 41):
        region = regions[i % len(regions)]
        base_lat, base_lng = REGION_COORDS[region]
        vehicles.append(
            FleetVehicle(
                vehicle_id=f"FF-{i:03d}",
                vehicle_type=random.choice(types),
                region=region,
                status=random.choice(statuses),
                capacity=random.choice([800.0, 1000.0, 1200.0, 500.0]),
                current_load=round(random.uniform(0, 900), 1),
                lat=round(base_lat + random.uniform(-0.5, 0.5), 4),
                lng=round(base_lng + random.uniform(-0.5, 0.5), 4),
                fuel_level=round(random.uniform(20, 100), 1),
                total_deliveries=random.randint(0, 500),
            )
        )
    db.add_all(vehicles)
    db.commit()


@router.get("")
def list_fleet(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    _seed_fleet(db)
    vehicles = db.query(FleetVehicle).order_by(FleetVehicle.vehicle_id).all()
    return [
        {
            "id": v.id,
            "vehicle_id": v.vehicle_id,
            "vehicle_type": v.vehicle_type,
            "region": v.region,
            "status": v.status,
            "capacity": v.capacity,
            "current_load": v.current_load,
            "utilization": round(v.current_load / v.capacity * 100, 1) if v.capacity else 0,
            "lat": v.lat,
            "lng": v.lng,
            "fuel_level": v.fuel_level,
            "total_deliveries": v.total_deliveries,
            "last_updated": v.last_updated.isoformat(),
        }
        for v in vehicles
    ]


@router.get("/summary")
def fleet_summary(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    _seed_fleet(db)
    vehicles = db.query(FleetVehicle).all()
    total = len(vehicles)
    active = sum(1 for v in vehicles if v.status == "active")
    en_route = sum(1 for v in vehicles if v.status == "en_route")
    idle = sum(1 for v in vehicles if v.status == "idle")
    maintenance = sum(1 for v in vehicles if v.status == "maintenance")
    avg_util = (
        sum(v.current_load / v.capacity * 100 for v in vehicles if v.capacity) / total
        if total else 0
    )
    low_fuel = sum(1 for v in vehicles if v.fuel_level < 25)

    return {
        "total": total,
        "active": active,
        "en_route": en_route,
        "idle": idle,
        "maintenance": maintenance,
        "avg_utilization": round(avg_util, 1),
        "low_fuel_count": low_fuel,
    }


@router.patch("/{vehicle_id}/status")
def update_status(
    vehicle_id: str,
    status: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "analyst")),
) -> dict:
    v = db.query(FleetVehicle).filter(FleetVehicle.vehicle_id == vehicle_id).first()
    if not v:
        from fastapi import HTTPException
        raise HTTPException(404, "Vehicle not found")
    v.status = status
    v.last_updated = datetime.utcnow()
    db.commit()
    return {"ok": True, "vehicle_id": vehicle_id, "status": status}
