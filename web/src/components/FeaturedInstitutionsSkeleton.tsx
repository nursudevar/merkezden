export default function FeaturedInstitutionsSkeleton() {
  return (
    <section className="featured-institutions-section">
      <div className="featured-institutions-header">
        <div className="featured-institutions-header-left">
          <h2 className="featured-institutions-title">Öne Çıkanlar</h2>
          <p className="featured-institutions-subtitle">Eğitim hayatınızı şekillendirecek en prestijli kurumları keşfedin.</p>
        </div>
      </div>
      <div className="featured-institutions-slider">
        <div className="featured-institutions-scroller">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="featured-institution-card" style={{ opacity: 0.6 }}>
              <div className="featured-institution-image-wrapper" style={{ backgroundColor: '#f3f4f6' }}>
                <div style={{ width: '100%', height: '100%', backgroundColor: '#e5e7eb' }} />
              </div>
              <div className="featured-institution-content">
                <div style={{ height: '16px', width: '120px', backgroundColor: '#e5e7eb', borderRadius: '4px', marginBottom: '8px' }} />
                <div style={{ height: '20px', width: '180px', backgroundColor: '#e5e7eb', borderRadius: '4px', marginBottom: '8px' }} />
                <div style={{ height: '14px', width: '100%', backgroundColor: '#e5e7eb', borderRadius: '4px', marginBottom: '4px' }} />
                <div style={{ height: '14px', width: '80%', backgroundColor: '#e5e7eb', borderRadius: '4px', marginBottom: '12px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ height: '16px', width: '60px', backgroundColor: '#e5e7eb', borderRadius: '4px' }} />
                  <div style={{ height: '16px', width: '80px', backgroundColor: '#e5e7eb', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="featured-institutions-view-all">
        <div style={{ height: '16px', width: '180px', backgroundColor: '#e5e7eb', borderRadius: '4px', margin: '0 auto' }} />
      </div>
    </section>
  );
}

