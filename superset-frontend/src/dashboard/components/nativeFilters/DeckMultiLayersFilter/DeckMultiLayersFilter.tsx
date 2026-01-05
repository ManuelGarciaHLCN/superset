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
import { FC, useMemo, useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Checkbox, Space, Typography } from '@superset-ui/core/components';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';

const { Text } = Typography;

const FilterContainer = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background: ${({ theme }) => theme.colorBgContainer};
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ChartSection = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const LayerCheckbox = styled(Checkbox)`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  
  .ant-checkbox {
    flex-shrink: 0;
  }
  
  .ant-checkbox + span {
    display: inline-block;
    line-height: 1.5;
  }
`;

interface DeckMultiLayersFilterProps {
  orientation?: 'horizontal' | 'vertical' | string;
}

const DeckMultiLayersFilter: FC<DeckMultiLayersFilterProps> = ({
  orientation = 'horizontal',
}) => {
  const dispatch = useDispatch();
  const chartLayoutItems = useChartLayoutItems();
  const dataMask = useSelector<RootState, Record<string, any>>(
    state => state.dataMask,
  );

  const charts = useSelector<RootState, Record<number, any>>(
    state => state.charts,
  );

  const sliceEntities = useSelector<RootState, Record<number, any>>(
    state => state.sliceEntities?.slices || {},
  );

  // State to store chart names fetched from API
  const [chartNames, setChartNames] = useState<Record<number, string>>({});

  // Find all deck_multi charts in the dashboard
  const deckMultiCharts = useMemo(() => {
    return chartLayoutItems
      .filter(item => {
        if (item.type !== CHART_TYPE || !item.meta?.chartId) {
          return false;
        }
        const chart = charts[item.meta.chartId];
        return (
          chart?.form_data?.viz_type === 'deck_multi' &&
          chart?.form_data?.deck_slices &&
          Array.isArray(chart.form_data.deck_slices) &&
          chart.form_data.deck_slices.length > 0
        );
      })
      .map(item => ({
        layoutItem: item,
        chart: charts[item.meta.chartId!],
      }));
  }, [chartLayoutItems, charts]);

  // Fetch chart names for slices that are not in sliceEntities
  useEffect(() => {
    const allSliceIds = new Set<number>();
    deckMultiCharts.forEach(({ chart }) => {
      const deckSlices = chart?.form_data?.deck_slices || [];
      deckSlices.forEach((sliceId: number) => {
        // Only fetch if not in sliceEntities and not already fetched
        if (
          !sliceEntities[sliceId] &&
          !chartNames[sliceId] &&
          !allSliceIds.has(sliceId)
        ) {
          allSliceIds.add(sliceId);
        }
      });
    });

    if (allSliceIds.size === 0) {
      return;
    }

    const sliceIdsArray = Array.from(allSliceIds);
    const queryParams = rison.encode({
      filters: [
        {
          col: 'id',
          opr: 'in',
          value: sliceIdsArray,
        },
      ],
      columns: ['id', 'slice_name'],
    });

    SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${queryParams}`,
    })
      .then(({ json }) => {
        const newChartNames: Record<number, string> = {};
        if (json?.result) {
          json.result.forEach((chart: { id: number; slice_name: string }) => {
            newChartNames[chart.id] = chart.slice_name;
          });
        }
        setChartNames(prev => ({ ...prev, ...newChartNames }));
      })
      .catch(() => {
        // Silently fail - we'll use fallback names
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckMultiCharts, sliceEntities]);

  const handleLayerToggle = useCallback(
    (chartId: number, layerIndex: number, checked: boolean, totalLayers: number) => {
      const filterId = `deck_multi_layers_${chartId}`;
      const currentMask = dataMask[filterId];
      const currentLayers = currentMask?.filterState?.value || [];

      let newLayers: number[];
      if (checked) {
        // Add layer if not already present
        newLayers = currentLayers.includes(layerIndex)
          ? currentLayers
          : [...currentLayers, layerIndex];
      } else {
        // Remove layer, but ensure at least one layer remains selected
        const filtered = currentLayers.filter((idx: number) => idx !== layerIndex);
        // If trying to deselect the last layer, prevent it
        if (filtered.length === 0) {
          return; // Don't allow deselecting the last layer
        }
        newLayers = filtered;
      }

      // Sort to maintain consistent order
      newLayers.sort((a, b) => a - b);

      dispatch(
        updateDataMask(filterId, {
          filterState: {
            value: newLayers,
          },
          extraFormData: {
            custom_form_data: {
              visible_layers: newLayers,
            },
          },
          ownState: {},
        }),
      );
    },
    [dispatch, dataMask],
  );

  const handleSelectAll = useCallback(
    (chartId: number, deckSlices: number[]) => {
      const filterId = `deck_multi_layers_${chartId}`;
      const allLayerIndices = deckSlices.map((_, index) => index);

      dispatch(
        updateDataMask(filterId, {
          filterState: {
            value: allLayerIndices,
          },
          extraFormData: {
            custom_form_data: {
              visible_layers: allLayerIndices,
            },
          },
          ownState: {},
        }),
      );
    },
    [dispatch],
  );

  const handleDeselectAll = useCallback(
    (chartId: number, deckSlices: number[]) => {
      // Don't allow deselecting all - keep at least the first layer
      const filterId = `deck_multi_layers_${chartId}`;
      const firstLayerIndex = 0;

      dispatch(
        updateDataMask(filterId, {
          filterState: {
            value: [firstLayerIndex],
          },
          extraFormData: {
            custom_form_data: {
              visible_layers: [firstLayerIndex],
            },
          },
          ownState: {},
        }),
      );
    },
    [dispatch],
  );

  if (deckMultiCharts.length === 0) {
    return null;
  }

  return (
    <FilterContainer>
      <Text strong style={{ marginBottom: 16, display: 'block' }}>
        {t('Filter Layers')}
      </Text>
      {deckMultiCharts.map(({ chart, layoutItem }) => {
        if (!chart) return null;

        const chartId = chart.id;
        const deckSlices = chart.form_data?.deck_slices || [];
        const filterId = `deck_multi_layers_${chartId}`;
        const selectedLayers =
          dataMask[filterId]?.filterState?.value ||
          deckSlices.map((_: any, index: number) => index); // Default: all selected

        const allSelected = selectedLayers.length === deckSlices.length;
        const noneSelected = selectedLayers.length === 0;
        const onlyOneSelected = selectedLayers.length === 1;

        return (
          <ChartSection key={chartId}>
            <Space direction="vertical" size="small">
              <div>
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && !noneSelected}
                  disabled={onlyOneSelected && deckSlices.length === 1}
                  onChange={e => {
                    if (e.target.checked) {
                      handleSelectAll(chartId, deckSlices);
                    } else {
                      handleDeselectAll(chartId, deckSlices);
                    }
                  }}
                >
                  {t('Select All')}
                </Checkbox>
              </div>
              {deckSlices.map((sliceId: number, layerIndex: number) => {
                // Get the chart name - try multiple sources
                let layerChartName = `Chart ${sliceId}`;
                
                // First try from queriesResponse (most reliable)
                if (chart.queriesResponse?.[0]?.data?.slices) {
                  const slice = chart.queriesResponse[0].data.slices.find(
                    (s: { slice_id: number; slice_name?: string }) =>
                      s.slice_id === sliceId,
                  );
                  if (slice?.slice_name) {
                    layerChartName = slice.slice_name;
                  }
                }
                
                // Fallback to sliceEntities
                if (layerChartName === `Chart ${sliceId}`) {
                  const sliceInfo = sliceEntities[sliceId];
                  if (sliceInfo?.slice_name) {
                    layerChartName = sliceInfo.slice_name;
                  }
                }
                
                // Fallback to fetched chartNames
                if (layerChartName === `Chart ${sliceId}` && chartNames[sliceId]) {
                  layerChartName = chartNames[sliceId];
                }
                
                const isLastSelected =
                  selectedLayers.length === 1 &&
                  selectedLayers.includes(layerIndex);

                return (
                  <LayerCheckbox
                    key={sliceId}
                    checked={selectedLayers.includes(layerIndex)}
                    disabled={isLastSelected}
                    onChange={e =>
                      handleLayerToggle(
                        chartId,
                        layerIndex,
                        e.target.checked,
                        deckSlices.length,
                      )
                    }
                  >
                    {layerChartName}
                  </LayerCheckbox>
                );
              })}
            </Space>
          </ChartSection>
        );
      })}
    </FilterContainer>
  );
};

export default DeckMultiLayersFilter;

