import { loginAction } from '../actions';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="center">
      <div className="brand">Teamly</div>
      <p className="muted">Корпоративная база знаний</p>
      <form action={loginAction} className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          Email
          <input name="email" type="email" required style={{ width: '100%' }} defaultValue="owner@acme.test" />
        </label>
        <label>
          Пароль
          <input name="password" type="password" required style={{ width: '100%' }} defaultValue="secret123" />
        </label>
        {searchParams.error && <div className="error">Неверный email или пароль</div>}
        <button type="submit">Войти</button>
      </form>
      <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
        Демо-доступ создаётся командой <code>npm run db:seed</code>.
      </p>
    </div>
  );
}
