import { NavLink, Outlet } from 'react-router'

export default function CostsLayout() {
  return (
    <>
      <div className="head">
        <div>
          <h1>Costs</h1>
          <p className="sub">Replacement and ownership costs based on the latest inventory import and the price list</p>
        </div>
      </div>
      <nav className="tabs">
        <NavLink to="/costs" end>Overview</NavLink>
        <NavLink to="/costs/prices">Price list</NavLink>
      </nav>
      <Outlet />
    </>
  )
}
