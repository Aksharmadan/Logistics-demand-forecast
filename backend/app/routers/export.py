import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import DemandRecord, User

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/report")
def export_report(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(DemandRecord).order_by(DemandRecord.record_date).all()
    df = pd.DataFrame(
        [
            {
                "date": r.record_date,
                "region": r.region,
                "sku": r.sku or "",
                "demand": r.demand_quantity,
                "source": r.source,
            }
            for r in rows
        ]
    )

    if format == "csv":
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        data = buf.getvalue().encode("utf-8")
        return StreamingResponse(
            iter([data]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="demand_export.csv"'},
        )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, height - 50, "Demand forecast — export report")
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 70, f"Generated: {datetime.utcnow().isoformat()}Z")
    c.drawString(50, height - 90, f"Rows: {len(df)}")
    y = height - 120
    for _, row in df.tail(40).iterrows():
        line = f"{row['date']} | {row['region']} | demand={row['demand']:.1f} | {row['source']}"
        c.drawString(50, y, line[:110])
        y -= 14
        if y < 80:
            c.showPage()
            y = height - 50
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="demand_report.pdf"'},
    )
