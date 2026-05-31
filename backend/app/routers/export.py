import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
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
    doc = SimpleDocTemplate(buf, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    elements.append(Paragraph("ForecastFlow: Demand Export Report", styles['Title']))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().isoformat()}Z", styles['Normal']))
    elements.append(Spacer(1, 12))
    
    data = [["Date", "Region", "Demand", "Source"]]
    for _, row in df.tail(100).iterrows():
        data.append([str(row['date']), row['region'], f"{row['demand']:.1f}", row['source']])
        
    t = Table(data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0ea5e9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
    ]))
    
    elements.append(t)
    doc.build(elements)
    
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="demand_report.pdf"'},
    )
