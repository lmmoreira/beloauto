interface FooterProps {
  slug: string;
}

export function Footer({ slug: _ }: FooterProps) {
  return (
    <footer
      style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--ba-text)',
        backgroundColor: 'var(--ba-secondary)',
      }}
    >
      <p>Powered by BeloAuto</p>
    </footer>
  );
}
