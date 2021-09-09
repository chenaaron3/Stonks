import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import './Watchlist.css';
import { formatDate } from '../helpers/utils';
import { getEndpoint } from '../helpers/api';

import { makeStyles } from '@material-ui/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TablePagination from '@material-ui/core/TablePagination';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Paper from '@material-ui/core/Paper';

import API from '../types/api';
import { BuyEntryData } from '../types/common';

interface RowData {
    symbol: string;
    buyDate: string;
    buyPrice: string;
    profit: string;
    action: string;
}

type RowKey = keyof RowData;

type OrderDirection = 'asc' | 'desc';

function descendingComparator(a: RowData, b: RowData, orderBy: RowKey) {
    if (b[orderBy] < a[orderBy]) {
        return -1;
    }
    if (b[orderBy] > a[orderBy]) {
        return 1;
    }
    return 0;
}

function getComparator(order: OrderDirection, orderBy: RowKey) {
    return order === 'desc'
        ? (a: RowData, b: RowData) => descendingComparator(a, b, orderBy)
        : (a: RowData, b: RowData) => -descendingComparator(a, b, orderBy);
}

function stableSort(array: any[], comparator: (a: RowData, b: RowData) => number) {
    const stabilizedThis = array.map((el, index) => [el, index]);
    stabilizedThis.sort((a, b) => {
        const order = comparator(a[0], b[0]);
        if (order !== 0) return order;
        return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
}

interface HeadCell {
    id: RowKey;
    numeric: boolean;
    disablePadding: boolean;
    label: string;
}

const headCells: HeadCell[] = [
    { id: 'symbol', numeric: false, disablePadding: true, label: 'Symbol' },
    { id: 'buyDate', numeric: false, disablePadding: false, label: 'Buy Date' },
    { id: 'buyPrice', numeric: true, disablePadding: false, label: 'Buy Price' },
    { id: 'profit', numeric: true, disablePadding: false, label: 'Profit' },
    { id: 'action', numeric: false, disablePadding: false, label: 'Action' },
];

type ClassNameMap<ClassKey extends string = string> = Record<ClassKey, string>;
interface EnhancedTableHeadProps {
    classes: ClassNameMap<"table" | "root" | "paper" | "visuallyHidden">;
    numSelected: number;
    onRequestSort: (event: any, property: RowKey) => void;
    order: OrderDirection;
    orderBy: RowKey;
    rowCount: number;
}

const EnhancedTableHead: React.FC<EnhancedTableHeadProps> = (props) => {
    const { classes, order, orderBy, numSelected, rowCount, onRequestSort } = props;
    const createSortHandler = (property: RowKey) => (event: any) => {
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

const useStyles = makeStyles((theme) => ({
    root: {
        width: '100%',
        height: '100%',
        // margin: 'auto',
        marginTop: '2px'
    },
    paper: {
        width: '100%',
        marginBottom: '2px'
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

interface EnhancedTableProps {
    rows: RowData[]
}

const EnhancedTable: React.FC<EnhancedTableProps> = (props) => {
    const classes = useStyles();
    const [order, setOrder] = React.useState<OrderDirection>('asc');
    const [orderBy, setOrderBy] = React.useState<RowKey>('symbol');
    const [selected, setSelected] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);

    let dense = false;

    const handleRequestSort = (event: any, property: RowKey) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleClick = (event: any, name: string) => {
        const selectedIndex = selected.indexOf(name);
        let newSelected: string[] = [];

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

    const handleChangePage = (event: any, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const isSelected = (name: string) => selected.indexOf(name) !== -1;

    const emptyRows = rowsPerPage - Math.min(rowsPerPage, props.rows.length - page * rowsPerPage);

    return (
        <div className={classes.root}>
            <Paper className={classes.paper}>
                <TableContainer>
                    <Table
                        className={classes.table}
                        aria-labelledby='tableTitle'
                        size={dense ? 'small' : 'medium'}
                        aria-label='enhanced table'
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
                                            role='checkbox'
                                            aria-checked={isItemSelected}
                                            tabIndex={-1}
                                            key={row.symbol}
                                            selected={isItemSelected}
                                            className='watchlist-row'
                                        >
                                            <TableCell align='right'>{row.symbol}</TableCell>
                                            <TableCell align='right'>{row.buyDate}</TableCell>
                                            <TableCell align='right'>{row.buyPrice}</TableCell>
                                            <TableCell align='right'>{row.profit}</TableCell>
                                            <TableCell align='right'>{row.action}</TableCell>
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
                    component='div'
                    count={props.rows.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </Paper>
        </div>
    );
}

const Watchlist = () => {
    const results = useAppSelector(state => state.backtest.results);
    const id = useAppSelector(state => state.backtest.id);
    const [rows, setRows] = useState<RowData[]>([]);

    useEffect(() => {
        getWatchlist();
    }, [id]);

    // load initial bought list
    const getWatchlist = () => {
        getEndpoint<API.Symbol.GetBoughtSymbols, API.Symbol._GetBoughtSymbols>('symbol/boughtSymbols', {})
            .then(boughtSymbols => {
                let rows: RowData[] = [];
                Object.keys(boughtSymbols).forEach(async (symbol) => {
                    let buyEntries = boughtSymbols[symbol];
                    getEntries(symbol, buyEntries)
                        .then(row => {
                            rows.push(row);
                            setRows(rows);
                        })                    
                })
            })
    }

    // searches up the latest prices for each stock
    const getEntries = (symbol: string, buyEntries: BuyEntryData[]) => {
        return new Promise<RowData>(resolve => {
            getEndpoint<API.Symbol.GetLatestPrice, API.Symbol._GetLatestPrice>('symbol/latestPrice', { symbol })
                .then(async latestPrice => {
                    buyEntries.forEach(buyEntry => {
                        let recentPrice = latestPrice['close'];
                        let buyPrice = buyEntry['price'];
                        let profit = recentPrice - buyPrice;
                        let profitDisplay = (profit < 0 ? '-' : '') + '$' + Math.abs(profit).toFixed(2);
                        let buyDate = buyEntry['date'];
                        let action = 'Hold';
                        if (results['symbolData'].hasOwnProperty(symbol)) {
                            results['symbolData'][symbol]['events'].forEach(event => {
                                if (buyDate < new Date(event['sellDate'])) {
                                    action = 'Sell';
                                }
                            })
                        }
                        resolve({ symbol, buyDate: formatDate(buyEntry['date']), buyPrice: '$' + buyPrice.toFixed(2), profit: profitDisplay, action });
                    });
                });
        })
    }

    return <div className='watchlist'>
        <span className='watchlist-title'>Watchlist</span>
        <EnhancedTable rows={rows} />
    </div>
}

export default Watchlist;