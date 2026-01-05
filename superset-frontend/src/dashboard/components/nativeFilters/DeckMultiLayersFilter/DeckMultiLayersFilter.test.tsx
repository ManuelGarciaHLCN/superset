/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { render, screen, waitFor, fireEvent } from 'spec/helpers/testing-library';
import DeckMultiLayersFilter from './DeckMultiLayersFilter';
import { updateDataMask } from 'src/dataMask/actions';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';

jest.mock('src/dataMask/actions', () => ({
  updateDataMask: jest.fn(),
}));

const mockUpdateDataMask = updateDataMask as jest.MockedFunction<
  typeof updateDataMask
>;

const mockChart = {
  id: 1,
  slice_name: 'Test Deck Multi Chart',
  form_data: {
    viz_type: 'deck_multi',
    deck_slices: [10, 20, 30],
  },
  queriesResponse: [
    {
      data: {
        slices: [
          { slice_id: 10, slice_name: 'Deck.gl Arcs' },
          { slice_id: 20, slice_name: 'Deck.gl Grid' },
          { slice_id: 30, slice_name: 'Deck.gl Hexagons' },
        ],
      },
    },
  ],
};

const mockLayoutItem = {
  id: 'CHART-1',
  type: CHART_TYPE,
  meta: {
    chartId: 1,
  },
};

const defaultState = {
  charts: {
    1: mockChart,
  },
  chartLayoutItems: [mockLayoutItem],
  dataMask: {},
  sliceEntities: {
    slices: {
      10: { slice_id: 10, slice_name: 'Deck.gl Arcs' },
      20: { slice_id: 20, slice_name: 'Deck.gl Grid' },
      30: { slice_id: 30, slice_name: 'Deck.gl Hexagons' },
    },
  },
};

test('renders filter when deck_multi charts are present', async () => {
  const { container } = render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: defaultState,
  });

  await waitFor(() => {
    expect(screen.getByText('Filter layers')).toBeInTheDocument();
  });

  expect(container).toBeInTheDocument();
});

test('renders all layer checkboxes with chart names', async () => {
  render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: defaultState,
  });

  await waitFor(() => {
    expect(screen.getByText('Deck.gl Arcs')).toBeInTheDocument();
    expect(screen.getByText('Deck.gl Grid')).toBeInTheDocument();
    expect(screen.getByText('Deck.gl Hexagons')).toBeInTheDocument();
  });
});

test('renders Select All checkbox', async () => {
  render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: defaultState,
  });

  await waitFor(() => {
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });
});

test('all layers are selected by default', async () => {
  render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: defaultState,
  });

  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    // Select All + 3 layers = 4 checkboxes
    expect(checkboxes).toHaveLength(4);
    // All should be checked by default
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
    });
  });
});

test('toggles layer selection', async () => {
  render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: defaultState,
  });

  await waitFor(() => {
    expect(screen.getByText('Deck.gl Arcs')).toBeInTheDocument();
  });

  const arcCheckbox = screen
    .getByText('Deck.gl Arcs')
    .closest('label')
    ?.querySelector('input[type="checkbox"]');

  if (arcCheckbox) {
    fireEvent.click(arcCheckbox);
    expect(mockUpdateDataMask).toHaveBeenCalledWith(
      'deck_multi_layers_1',
      expect.objectContaining({
        filterState: expect.objectContaining({
          value: expect.arrayContaining([1, 2]),
        }),
      }),
    );
  }
});

test('prevents deselecting last layer', async () => {
  const stateWithOneSelected = {
    ...defaultState,
    dataMask: {
      'deck_multi_layers_1': {
        filterState: {
          value: [0], // Only first layer selected
        },
      },
    },
  };

  render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: stateWithOneSelected,
  });

  await waitFor(() => {
    const arcCheckbox = screen
      .getByText('Deck.gl Arcs')
      .closest('label')
      ?.querySelector('input[type="checkbox"]');
    expect(arcCheckbox).toBeDisabled();
  });
});

test('does not render when no deck_multi charts are present', () => {
  const stateWithoutDeckMulti = {
    ...defaultState,
    charts: {
      1: {
        ...mockChart,
        form_data: {
          viz_type: 'table',
        },
      },
    },
  };

  const { container } = render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: stateWithoutDeckMulti,
  });

  expect(screen.queryByText('Filter layers')).not.toBeInTheDocument();
  expect(container.firstChild).toBeNull();
});

test('handles Select All toggle', async () => {
  render(<DeckMultiLayersFilter />, {
    useRedux: true,
    initialState: defaultState,
  });

  await waitFor(() => {
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  const selectAllCheckbox = screen
    .getByText('Select All')
    .closest('label')
    ?.querySelector('input[type="checkbox"]');

  if (selectAllCheckbox) {
    fireEvent.click(selectAllCheckbox);
    // Should keep at least one layer selected
    expect(mockUpdateDataMask).toHaveBeenCalled();
  }
});

