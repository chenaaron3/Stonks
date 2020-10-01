import React, { createRef } from 'react';
import { connect } from 'react-redux';
import "./Watchlist.css";
import { formatDate } from "../helpers/utils";

import PropTypes from 'prop-types';
import { lighten, makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Paper from '@material-ui/core/Paper';

function descendingComparator(a, b, orderBy) {
    if (b[orderBy] < a[orderBy]) {
        return -1;
    }
    if (b[orderBy] > a[orderBy]) {
        return 1;
    }
    return 0;
}

function getComparator(order, orderBy) {
    return order === 'desc'
        ? (a, b) => descendingComparator(a, b, orderBy)
        : (a, b) => -descendingComparator(a, b, orderBy);
}

function stableSort(array, comparator) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}

const headCells = [
    { id: 'symbol', numeric: false, disablePadding: true, label: 'Symbol' },
    { id: 'buyDate', numeric: false, disablePadding: false, label: 'Buy Date' },
    { id: 'buyPrice', numeric: true, disablePadding: false, label: 'Buy Price' },
    { id: 'profit', numeric: true, disablePadding: false, label: 'Profit' },
    { id: 'action', numeric: false, disablePadding: false, label: 'Action' },
];

function EnhancedTableHead(props) {
    const { classes, order, orderBy, numSelected, rowCount, onRequestSort } = props;
    const createSortHandler = (property) => (event) => {
        onRequestSort(event, property);
    };

    return (
        <TableHead>
            <TableRow>
                {headCells.map((headCell) => (
                    <TableCell
                        key={headCell.id}
                        align={'right'}
                        padding={'default'}
                        sortDirection={orderBy === headCell.id ? order : false}
                    >
                        <TableSortLabel
                            active={orderBy === headCell.id}
                            direction={orderBy === headCell.id ? order : 'asc'}
                            onClick={createSortHandler(headCell.id)}
                        >
                            {headCell.label}
                            {orderBy === headCell.id ? (
                                <span className={classes.visuallyHidden}>
                                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                                </span>
                            ) : null}
                        </TableSortLabel>
                    </TableCell>
                ))}
            </TableRow>
        </TableHead>
    );
}

EnhancedTableHead.propTypes = {
    classes: PropTypes.object.isRequired,
    numSelected: PropTypes.number.isRequired,
    onRequestSort: PropTypes.func.isRequired,
    order: PropTypes.oneOf(['asc', 'desc']).isRequired,
    orderBy: PropTypes.string.isRequired,
    rowCount: PropTypes.number.isRequired,
};

const useStyles = makeStyles((theme) => ({
    root: {
        width: '80%',
        height: '100%',
        // margin: 'auto',
        marginTop: theme.spacing(2),
    },
    paper: {
        width: '100%',
        marginBottom: theme.spacing(2),
    },
    table: {
        minWidth: 750,
    },
    visuallyHidden: {
        border: 0,
        clip: 'rect(0 0 0 0)',
        height: 1,
        margin: -1,
        overflow: 'hidden',
        padding: 0,
        position: 'absolute',
        top: 20,
        width: 1,
    },
}));

function EnhancedTable(props) {
    const classes = useStyles();
    const [order, setOrder] = React.useState('asc');
    const [orderBy, setOrderBy] = React.useState('symbol');
    const [selected, setSelected] = React.useState([]);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    let dense = false;

    const handleRequestSort = (event, property) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleClick = (event, name) => {
        const selectedIndex = selected.indexOf(name);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, name);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1),
            );
        }

        setSelected(newSelected);
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const isSelected = (name) => selected.indexOf(name) !== -1;

    const emptyRows = rowsPerPage - Math.min(rowsPerPage, props.rows.length - page * rowsPerPage);

    return (
        <div className={classes.root}>
            <Paper className={classes.paper}>
                <TableContainer>
                    <Table
                        className={classes.table}
                        aria-labelledby="tableTitle"
                        size={dense ? 'small' : 'medium'}
                        aria-label="enhanced table"
                    >
                        <EnhancedTableHead
                            classes={classes}
                            numSelected={selected.length}
                            order={order}
                            orderBy={orderBy}
                            onRequestSort={handleRequestSort}
                            rowCount={props.rows.length}
                        />
                        <TableBody>
                            {stableSort(props.rows, getComparator(order, orderBy))
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((row, index) => {
                                    const isItemSelected = isSelected(row.symbol);
                                    return (
                                        <TableRow
                                            hover
                                            onClick={(event) => handleClick(event, row.symbol)}
                                            role="checkbox"
                                            aria-checked={isItemSelected}
                                            tabIndex={-1}
                                            key={row.symbol}
                                            selected={isItemSelected}
                                            className="watchlist-row"
                                        >
                                            <TableCell align="right">{row.symbol}</TableCell>
                                            <TableCell align="right">{row.buyDate}</TableCell>
                                            <TableCell align="right">{row.buyPrice}</TableCell>
                                            <TableCell align="right">{row.profit}</TableCell>
                                            <TableCell align="right">{row.action}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            {emptyRows > 0 && (
                                <TableRow style={{ height: (dense ? 33 : 53) * emptyRows }}>
                                    <TableCell colSpan={6} />
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[5, 10]}
                    component="div"
                    count={props.rows.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onChangePage={handleChangePage}
                    onChangeRowsPerPage={handleChangeRowsPerPage}
                />
            </Paper>
        </div>
    );
}

class Watchlist extends React.Component {
    constructor(props) {
        super(props);
        this.state = { rows: [] };
    }

    componentDidMount() {
        this.getWatchlist();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.id != this.props.id) {
            this.getWatchlist();
        }
    }

    // load initial bought list
    getWatchlist = () => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/boughtSymbols`)
            .then(res => res.json())
            .then(boughtSymbols => {
                let rows = [];
                Object.keys(boughtSymbols).forEach(symbol => {
                    let buyEntries = boughtSymbols[symbol];
                    this.getEntries(symbol, buyEntries, rows);
                })
            })
    }

    // searches up the latest prices for each stock
    getEntries = (symbol, buyEntries, rows) => {
        fetch(`${process.env.NODE_ENV == "production" ? process.env.REACT_APP_SUBDIRECTORY : ""}/latestPrice?symbol=${symbol}`)
            .then(res => res.json())
            .then(async latestPrice => {
                buyEntries.forEach(buyEntry => {
                    let recentPrice = latestPrice["adjClose"];
                    console.log(buyEntry);
                    let buyPrice = buyEntry["price"]
                    let profit = recentPrice - buyPrice;
                    let profitDisplay = (profit < 0 ? "-" : "") + "$" + Math.abs(profit).toFixed(2);
                    let buyDate = buyEntry["date"];
                    let action = "Hold";
                    if(this.props.results["symbolData"].hasOwnProperty(symbol)) {
                        this.props.results["symbolData"][symbol]["events"].forEach(event => {
                            if (buyDate < event["sellDate"]) {
                                action = "Sell";
                            }
                        })
                    }
                    rows.push({ symbol, buyDate: formatDate(buyEntry["date"]), buyPrice: "$" + buyPrice.toFixed(2), profit: profitDisplay, action });
                });
                this.setState({ rows });
            });
    }

    render() {
        return <div className="watchlist">
            <span className="watchlist-title">Watchlist</span>
            <EnhancedTable rows={this.state.rows} />
        </div>
    }
}

let mapStateToProps = (state) => {
    let results = state.backtestResults;
    return { results, id: state.id };
};

export default connect(mapStateToProps)(Watchlist);